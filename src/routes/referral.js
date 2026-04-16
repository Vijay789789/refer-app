const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { _creditWallet } = require('./auth');
const { broadcastRealEvent } = require('../socket');

router.use(authenticate);

router.get('/my-code', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({
      success: true, referralCode: user.referralCode,
      shareUrl: `sharingapp://referral/${user.referralCode}`,
      shareMessage: `Join using my code ${user.referralCode} to get ₹10 bonus. Link: sharingapp://referral/${user.referralCode}`,
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/apply', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Application code is required.' });

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found.' });
    if (currentUser.referralCode === code.toUpperCase()) return res.status(400).json({ success: false, message: 'Cannot use own code.' });
    if (currentUser.referredBy) return res.status(400).json({ success: false, message: 'You have already applied a code.' });

    const referrer = await User.findOne({ referralCode: code.toUpperCase() });
    if (!referrer) return res.status(400).json({ success: false, message: 'Invalid code.' });

    // Anti-fraud: Check if self-referring on the same device
    if (referrer.deviceId === currentUser.deviceId) {
      return res.status(400).json({ success: false, message: 'Cannot use a code generated on the same device.' });
    }

    // Anti-fraud: Check if another user on this device already used a code
    const deviceClaimed = await User.findOne({ deviceId: currentUser.deviceId, referredBy: { $ne: null } });
    if (deviceClaimed) {
      return res.status(400).json({ success: false, message: 'A code has already been applied on this device by another account.' });
    }

    const Deposit = require('../models/Deposit');
    const depositCount = await Deposit.countDocuments({ userId: referrer._id, status: 'completed' });
    if (depositCount === 0 && (referrer.referralCount || 0) >= 3) {
      return res.status(400).json({ success: false, message: 'This referral code has reached its maximum usage limit.' });
    }

    currentUser.referredBy = referrer._id;
    await currentUser.save();

    referrer.referralCount = (referrer.referralCount || 0) + 1;
    await referrer.save();

    await _creditWallet(currentUser._id, 0, 'Referral Applied', `Applied code: ${code.toUpperCase()}`);
    await _creditWallet(referrer._id, 50, 'Referral Reward', `${currentUser.firstName} used your code`);

    // Broadcast the real earnings to all live users!
    if (referrer.firstName) {
        broadcastRealEvent(referrer.firstName, 'earned ₹50 with refer');
    }

    const wallet = await Wallet.findOne({ userId: currentUser._id });
    res.json({ success: true, message: `Code applied successfully!`, yourNewBalance: wallet?.balance });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/history', async (req, res) => {
  try {
    const referrals = await User.find({ referredBy: req.user.id }).select('firstName lastName createdAt');
    const history = referrals.map(u => ({ name: `${u.firstName} ${u.lastName}`, joinedAt: u.createdAt }));
    res.json({ success: true, totalReferrals: referrals.length, totalEarned: referrals.length * 50, referrals: history });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const totalReferrals = await User.countDocuments({ referredBy: req.user.id });
    const transactions = await Transaction.find({ userId: req.user.id, title: 'Referral Reward' });
    const referralEarnings = transactions.reduce((sum, t) => sum + t.amount, 0);

    const Deposit = require('../models/Deposit');
    const depositCount = await Deposit.countDocuments({ userId: req.user.id, status: 'completed' });
    const isLimitReached = totalReferrals >= 3 && depositCount === 0;

    const wallet = await require('../models/Wallet').findOne({ userId: req.user.id });

    res.json({ 
      success: true, 
      totalReferrals, 
      totalEarningsFromReferrals: referralEarnings, 
      potentialEarnings: `₹${(totalReferrals * 50).toFixed(0)} earned`,
      isLimitReached,
      hasAppliedReferral: !!user.referredBy,
      walletBalance: wallet ? wallet.balance : 0
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
