const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { generateReferralCode, generateToken } = require('../utils/helpers');
const { broadcastRealEvent } = require('../socket');
const authenticate = require('../middleware/auth');

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, isRestricted: !!user.isRestricted, user: { id: user._id, firstName: user.firstName, lastName: user.lastName, phone: user.phone, referralCode: user.referralCode } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/check-device', async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) return res.status(400).json({ success: false, message: 'No device ID provided' });
    
    const user = await User.findOne({ deviceId }).lean();
    if (user) {
      res.json({ success: true, registered: true, user: { firstName: user.firstName, lastName: user.lastName, phone: user.phone } });
    } else {
      res.json({ success: true, registered: false });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, phone, deviceId, referredByCode } = req.body;
    if (!firstName || !lastName || !phone || !deviceId) {
      return res.status(400).json({ success: false, message: 'Missing fields.' });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User already registered. Please use /login.' });
    }

    let referrer = null;
    if (referredByCode) {
      referrer = await User.findOne({ referralCode: referredByCode.toUpperCase() });
      if (!referrer) return res.status(400).json({ success: false, message: 'Invalid referral code.' });

      // Check max referral limits
      const depositCount = await require('../models/Deposit').countDocuments({ userId: referrer._id, status: 'completed' });
      if (depositCount === 0 && (referrer.referralCount || 0) >= 3) {
        // Skip applying referral code if they've hit the limit without depositing
        referrer = null;
      }
    }

    const newUser = new User({
      firstName, lastName, phone, deviceId,
      referralCode: generateReferralCode(deviceId),
      referredBy: referrer ? referrer._id : null
    });
    await newUser.save();

    await Wallet.create({ userId: newUser._id, balance: 0 });

    await _creditWallet(newUser._id, 200, 'Signup Bonus', 'Reward for joining via referral link');
    
    if (newUser.firstName) {
      broadcastRealEvent(newUser.firstName, 'earned ₹200 signup bonus');
    }

    if (referrer) {
      referrer.referralCount = (referrer.referralCount || 0) + 1;
      await referrer.save();
      await _creditWallet(referrer._id, 50, 'Referral Reward', `${firstName} joined using your code`);
    }

    const token = generateToken({ id: newUser._id.toString(), phone, referralCode: newUser.referralCode });

    res.status(201).json({
      success: true, message: 'User registered.', token,
      user: { id: newUser._id, firstName, lastName, phone, referralCode: newUser.referralCode }
    });
  } catch (e) { 
    if (e.code === 11000) {
      return res.status(409).json({ success: false, message: 'Phone number already registered. Please login.' });
    }
    res.status(500).json({ success: false, message: e.message }); 
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, deviceId } = req.body;
    if (!phone || !deviceId) return res.status(400).json({ success: false, message: 'phone and deviceId are required.' });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.isRestricted) {
      return res.status(403).json({ success: false, message: 'Account restricted.', isRestricted: true });
    }

    if (user.deviceId !== deviceId) {
      user.deviceId = deviceId;
      await user.save();
    }

    const token = generateToken({ id: user._id.toString(), phone, referralCode: user.referralCode });
    res.json({ success: true, message: 'Login successful.', token, user: { id: user._id, firstName: user.firstName, lastName: user.lastName, phone: user.phone, referralCode: user.referralCode } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

async function _creditWallet(userId, amount, title, description) {
  await Wallet.findOneAndUpdate({ userId }, { $inc: { balance: amount } }, { upsert: true });
  await Transaction.create({ userId, type: 'credit', amount, title, description });
}

module.exports = router;
module.exports._creditWallet = _creditWallet;
