const mongoose = require('mongoose');

const paymentDetailsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  upiId: { type: String },
  bankAccountNumber: { type: String },
  bankIFSC: { type: String },
  bankHolderName: { type: String },
  preferredMethod: { type: String, enum: ['upi', 'bank', null], default: null },
}, { timestamps: true });

module.exports = mongoose.model('PaymentDetails', paymentDetailsSchema);
