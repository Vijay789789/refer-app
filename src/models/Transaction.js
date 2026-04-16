const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
