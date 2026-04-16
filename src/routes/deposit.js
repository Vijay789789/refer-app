const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const Deposit = require('../models/Deposit');
const User = require('../models/User');
const { broadcastRealEvent } = require('../socket');

router.use(authenticate);

router.post('/request', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Positive amount required.' });

    const deposit = await Deposit.create({ userId: req.user.id, amount, status: 'pending' });

    const user = await User.findById(req.user.id);
    if (user && user.firstName) {
        broadcastRealEvent(user.firstName, `added ₹${amount}`);
    }

    res.json({ success: true, message: `Deposit of ₹${amount} requested.`, deposit });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/history', async (req, res) => {
  try {
    const deposits = await Deposit.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, deposits });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
