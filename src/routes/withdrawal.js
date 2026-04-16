const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const { broadcastRealEvent } = require('../socket');
const PaymentDetails = require('../models/PaymentDetails');

router.use(authenticate);

router.post('/request', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 500) return res.status(400).json({ success: false, message: 'Minimum withdrawal amount is ₹500.' });

    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found.' });

    const pendingWithdrawals = await Withdrawal.find({ userId: req.user.id, status: 'pending' });
    const totalPending = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

    if (amount + totalPending > wallet.balance) {
      return res.status(400).json({ success: false, message: `Insufficient balance considering pending requests. Available: ₹${wallet.balance - totalPending}, Requested: ₹${amount}` });
    }

    const payment = await PaymentDetails.findOne({ userId: req.user.id });
    if (!payment || (!payment.upiId && !payment.bankAccountNumber)) return res.status(400).json({ success: false, message: 'No payment method found.' });

    const method = payment.preferredMethod;
    const destination = method === 'upi' ? `UPI: ${payment.upiId}` : `A/C: ${payment.bankAccountNumber} | IFSC: ${payment.bankIFSC} | Name: ${payment.bankHolderName}`;

    const withdrawal = await Withdrawal.create({ userId: req.user.id, amount, method, destination, status: 'pending' });

    const user = await User.findById(req.user.id);
    if (user && user.firstName) {
        broadcastRealEvent(user.firstName, `withdrew ₹${amount}`);
    }

    res.json({ success: true, message: `Withdrawal of ₹${amount} requested.`, withdrawal, newBalance: wallet.balance });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/history', async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, withdrawals });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/status/:id', async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findOne({ _id: req.params.id, userId: req.user.id });
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found.' });
    res.json({ success: true, withdrawal });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
