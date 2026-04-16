const { v4: uuidv4 } = require('uuid');

/**
 * Generates a short, unique alphanumeric referral code from the deviceId.
 * Format: USR + first 5 chars of uuid hash = e.g. "USRA1B2C"
 */
const generateReferralCode = (deviceId) => {
  let hash = 0;
  const str = deviceId || uuidv4();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return ('USR' + Math.abs(hash).toString(36)).toUpperCase().substring(0, 8);
};

/**
 * Generates a JWT token for the given user.
 */
const generateToken = (user) => {
  return require('jsonwebtoken').sign(
    { id: user.id, phone: user.phone, referralCode: user.referralCode },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

module.exports = { generateReferralCode, generateToken };
