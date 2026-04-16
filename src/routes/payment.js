const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const PaymentDetails = require('../models/PaymentDetails');

router.use(authenticate);

router.get('/details', async (req, res) => {
  try {
    const payment = await PaymentDetails.findOne({ userId: req.user.id });

    if (!payment) {
      return res.json({ success: true, hasPaymentMethod: false, details: null });
    }

    return res.json({
      success: true,
      hasPaymentMethod: !!(payment.upiId || payment.bankAccountNumber),
      preferredMethod: payment.preferredMethod,
      details: {
        upiId: payment.upiId || null,
        bankAccountNumber: payment.bankAccountNumber || null,
        bankIFSC: payment.bankIFSC || null,
        bankHolderName: payment.bankHolderName || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/upi', async (req, res) => {
  try {
    const { upiId } = req.body;
    if (!upiId || !upiId.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid UPI ID is required (must include @).' });
    }

    await PaymentDetails.findOneAndUpdate(
      { userId: req.user.id },
      { upiId: upiId.toLowerCase().trim(), preferredMethod: 'upi' },
      { upsert: true }
    );

    return res.json({ success: true, message: `UPI ID "${upiId}" saved successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/bank', async (req, res) => {
  try {
    const { accountNumber, ifsc, holderName } = req.body;
    if (!accountNumber || !ifsc || !holderName) return res.status(400).json({ success: false, message: 'accountNumber, ifsc and holderName required.' });

    await PaymentDetails.findOneAndUpdate(
      { userId: req.user.id },
      { bankAccountNumber: accountNumber, bankIFSC: ifsc.toUpperCase(), bankHolderName: holderName, preferredMethod: 'bank' },
      { upsert: true }
    );

    return res.json({ success: true, message: `Bank account (${accountNumber}) saved.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
