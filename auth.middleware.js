// ============================================================
// SMARTWORKOUT AI — JWT Auth Middleware
// ============================================================
const jwt = require('jsonwebtoken');
const { query } = require('../utils/db');

/**
 * Verify JWT and attach user to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB (catches deactivated accounts)
    const result = await query(
      'SELECT id, email, name, avatar_url, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Require Pro subscription for protected features
 */
const requirePro = async (req, res, next) => {
  try {
    const result = await query(
      "SELECT plan, status FROM subscriptions WHERE user_id = $1",
      [req.user.id]
    );

    const sub = result.rows[0];
    if (!sub || sub.plan !== 'pro' || sub.status !== 'active') {
      return res.status(403).json({
        error: 'Pro subscription required',
        code: 'REQUIRES_PRO',
        upgradeUrl: '/subscribe',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Verify email is confirmed
 */
const requireVerified = (req, res, next) => {
  if (!req.user.email_verified) {
    return res.status(403).json({
      error: 'Please verify your email address',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }
  next();
};

module.exports = { authenticate, requirePro, requireVerified };
