const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true },
  deviceId: { type: String, required: true },
  referralCode: { type: String, required: true, unique: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  referralCount: { type: Number, default: 0 },
  isRestricted: { type: Boolean, default: false },
}, { timestamps: true });

// Optional: ensure unique phone and deviceId? 
// According to auth logic, these are unique identifiers for a single user for simplified login
userSchema.index({ phone: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
