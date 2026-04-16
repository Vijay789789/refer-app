const jwt = require('jsonwebtoken');

/**
 * JWT Auth Middleware
 * Verifies the Bearer token and attaches `req.user` to the request.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Lazy check restrict status
    const User = require('../models/User');
    User.findById(decoded.id).then(userRecord => {
      if (!userRecord) {
        return res.status(401).json({ success: false, message: 'User no longer exists.' });
      }
      if (userRecord.isRestricted) {
        return res.status(403).json({ success: false, message: 'Account restricted.', isRestricted: true });
      }
      req.user = decoded;
      next();
    }).catch(err => {
      return res.status(500).json({ success: false, message: 'Auth check error.' });
    });

  } catch (err) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired token.' });
  }
};

module.exports = authenticate;
