const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

// Admin Check Middleware
const isAdmin = async (req, res, next) => {
  try {
    const { phone } = req.user; // Assuming user is populated from token middleware
    if (phone === '7869441523') {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: 'Admin check failed.' });
  }
};

// GET /admin/users - List all users with their current wallet balance
router.get('/users', async (req, res) => {
  try {
    // Check phone directly from token since middleware might not be fully configured yet for this new route
    const userPhone = req.headers['x-user-phone']; 
    if (userPhone !== '7869441523') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const users = await User.find({}).lean();
    const userList = await Promise.all(users.map(async (u) => {
      const wallet = await Wallet.findOne({ userId: u._id });
      return {
        ...u,
        balance: wallet ? wallet.balance : 0
      };
    }));

    res.json({ success: true, users: userList });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /admin/users/:userId/restrict - Toggle user restriction
router.post('/users/:userId/restrict', async (req, res) => {
  try {
    const userPhone = req.headers['x-user-phone']; 
    if (userPhone !== '7869441523') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    
    // Cannot restrict self (admin)
    if (user.phone === '7869441523') {
      return res.status(400).json({ success: false, message: 'Cannot restrict the main administrator.' });
    }

    user.isRestricted = !user.isRestricted;
    await user.save();

    res.json({ success: true, message: `User account has been ${user.isRestricted ? 'restricted' : 'unrestricted'}.`, isRestricted: user.isRestricted });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /admin/credit - Manually credit points to a user
router.post('/credit', async (req, res) => {
  try {
    const userPhone = req.headers['x-user-phone']; 
    if (userPhone !== '7869441523') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { userId, amount, reason } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'userId and amount are required.' });
    }

    const numAmount = parseFloat(amount);
    const type = numAmount >= 0 ? 'credit' : 'debit';
    const displayAmount = Math.abs(numAmount);

    const wallet = await Wallet.findOneAndUpdate(
      { userId },
      { $inc: { balance: numAmount } },
      { upsert: true, new: true }
    );

    await Transaction.create({
      userId,
      type: type,
      amount: displayAmount,
      title: numAmount >= 0 ? 'Admin Credit' : 'Admin Debit',
      description: reason || `Points ${numAmount >= 0 ? 'added' : 'removed'} by Admin`
    });

    res.json({ 
      success: true, 
      message: `Successfully ${numAmount >= 0 ? 'credited' : 'debited'} ₹${displayAmount} to user account.`,
      newBalance: wallet.balance
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

const Withdrawal = require('../models/Withdrawal');

// GET /admin/withdrawals - List all pending withdrawals
router.get('/withdrawals', async (req, res) => {
  try {
    const userPhone = req.headers['x-user-phone']; 
    if (userPhone !== '7869441523') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const withdrawals = await Withdrawal.find({ status: 'pending' })
      .populate('userId', 'firstName lastName phone')
      .lean()
      .sort({ createdAt: -1 });

    const PaymentDetails = require('../models/PaymentDetails');
    const withdrawalsData = await Promise.all(withdrawals.map(async (w) => {
      let realDestination = w.destination;
      if (w.userId && w.userId._id) {
        const payment = await PaymentDetails.findOne({ userId: w.userId._id }).lean();
        if (payment) {
          realDestination = payment.preferredMethod === 'upi' 
            ? `UPI: ${payment.upiId}` 
            : `A/C: ${payment.bankAccountNumber}\nIFSC: ${payment.bankIFSC}\nName: ${payment.bankHolderName}`;
        }
      }
      return { ...w, destination: realDestination };
    }));

    res.json({ success: true, withdrawals: withdrawalsData });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /admin/withdrawals/action - Approve or reject a withdrawal
router.post('/withdrawals/action', async (req, res) => {
  try {
    const userPhone = req.headers['x-user-phone']; 
    if (userPhone !== '7869441523') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { withdrawalId, action } = req.body; // action: 'approve' | 'reject'
    if (!withdrawalId || !action) {
      return res.status(400).json({ success: false, message: 'withdrawalId and action are required.' });
    }

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal || withdrawal.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found or not pending.' });
    }

    if (action === 'approve') {
      const wallet = await Wallet.findOne({ userId: withdrawal.userId });
      if (!wallet || wallet.balance < withdrawal.amount) {
        return res.status(400).json({ success: false, message: 'User does not have enough balance to complete this withdrawal.' });
      }

      wallet.balance -= withdrawal.amount;
      await wallet.save();

      await Transaction.create({
        userId: withdrawal.userId,
        type: 'debit',
        amount: -Math.abs(withdrawal.amount), 
        title: 'Funds Withdrawal (Approved)',
        description: `Withdrawal to ${withdrawal.destination}`
      });

      withdrawal.status = 'completed';
      await withdrawal.save();

      res.json({ success: true, message: 'Withdrawal approved successfully.' });
    } else if (action === 'reject') {
      withdrawal.status = 'failed'; // Using 'failed' as reject state
      await withdrawal.save();
      res.json({ success: true, message: 'Withdrawal rejected.' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid action.' });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

const Deposit = require('../models/Deposit');

// GET /admin/deposits - List all pending deposits
router.get('/deposits', async (req, res) => {
  try {
    const userPhone = req.headers['x-user-phone']; 
    if (userPhone !== '7869441523') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const deposits = await Deposit.find({ status: 'pending' })
      .populate('userId', 'firstName lastName phone')
      .lean()
      .sort({ createdAt: -1 });

    res.json({ success: true, deposits });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /admin/deposits/action - Approve or reject a deposit
router.post('/deposits/action', async (req, res) => {
  try {
    const userPhone = req.headers['x-user-phone']; 
    if (userPhone !== '7869441523') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { depositId, action } = req.body; // action: 'approve' | 'reject'
    if (!depositId || !action) {
      return res.status(400).json({ success: false, message: 'depositId and action are required.' });
    }

    const deposit = await Deposit.findById(depositId);
    if (!deposit || deposit.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Deposit request not found or not pending.' });
    }

    if (action === 'approve') {
      const wallet = await Wallet.findOneAndUpdate(
        { userId: deposit.userId },
        { $inc: { balance: deposit.amount } },
        { upsert: true, new: true }
      );

      await Transaction.create({
        userId: deposit.userId,
        type: 'credit',
        amount: Math.abs(deposit.amount), 
        title: 'Wallet Deposit (Approved)',
        description: `Funds manually verified by admin`
      });

      deposit.status = 'completed';
      await deposit.save();

      res.json({ success: true, message: 'Deposit approved successfully.' });
    } else if (action === 'reject') {
      deposit.status = 'failed';
      await deposit.save();
      res.json({ success: true, message: 'Deposit rejected.' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid action.' });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

const AdminConfig = require('../models/AdminConfig');

// GET /admin/config - Get dynamic configs
router.get('/config', async (req, res) => {
  try {
    const userPhone = req.headers['x-user-phone']; 
    if (userPhone !== '7869441523') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const configs = await AdminConfig.find({});
    // Convert array of {key, value} into a single object
    const configMap = configs.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    res.json({ success: true, configs: configMap });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /admin/config - Set a dynamic config
router.post('/config', async (req, res) => {
  try {
    const userPhone = req.headers['x-user-phone']; 
    if (userPhone !== '7869441523') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { key, value } = req.body;
    if (!key) return res.status(400).json({ success: false, message: 'Key is required' });

    await AdminConfig.findOneAndUpdate(
      { key },
      { value },
      { upsert: true }
    );

    res.json({ success: true, message: 'Configuration saved successfully.' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
