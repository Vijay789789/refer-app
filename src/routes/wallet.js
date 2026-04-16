const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found.' });

    const transactions = await Transaction.find({ userId: req.user.id }).lean();
    const pendingWithdrawals = await Withdrawal.find({ userId: req.user.id, status: 'pending' }).lean();

    const mappedWithdrawals = pendingWithdrawals.map(w => ({
      _id: w._id,
      title: 'Withdrawal Requested (Pending)',
      amount: -w.amount,
      type: 'debit',
      createdAt: w.createdAt,
      updatedAt: w.updatedAt
    }));

    const allActivity = [...transactions, ...mappedWithdrawals].sort((a, b) => b.createdAt - a.createdAt);

    return res.json({
      success: true,
      balance: wallet.balance,
      transactions: allActivity,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/balance', async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found.' });

    return res.json({ success: true, balance: wallet.balance });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

const AdminConfig = require('../models/AdminConfig');

router.get('/deposit-config', async (req, res) => {
  try {
    const upiIdDoc = await AdminConfig.findOne({ key: 'adminUpiId' });
    const payeeNameDoc = await AdminConfig.findOne({ key: 'adminPayeeName' });
    const appLinkDoc = await AdminConfig.findOne({ key: 'appDownloadLink' });

    res.json({
      success: true,
      config: {
        upiId: upiIdDoc ? upiIdDoc.value : null,
        payeeName: payeeNameDoc ? payeeNameDoc.value : null,
        appDownloadLink: appLinkDoc ? appLinkDoc.value : null,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
