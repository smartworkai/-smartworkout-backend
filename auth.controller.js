// ============================================================
// SMARTWORKOUT AI — Auth Controller
// ============================================================
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const { query } = require('../utils/db');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email.service');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
  return { accessToken, refreshToken };
};

const formatUser = (user) => ({
  id:        user.id,
  email:     user.email,
  name:      user.name,
  avatarUrl: user.avatar_url,
  provider:  user.provider,
  emailVerified: user.email_verified,
});

// ─────────────────────────────────────────────
// SIGNUP
// ─────────────────────────────────────────────
exports.signup = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: 'Validation failed', details: errors.array() });
    }

    const { email, password, name } = req.body;

    // Check existing
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash      = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const verification_token = uuidv4();

    // Insert user
    const result = await query(
      `INSERT INTO users (email, password_hash, name, verification_token)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, avatar_url, provider, email_verified`,
      [email, password_hash, name, verification_token]
    );
    const user = result.rows[0];

    // Create empty profile
    await query('INSERT INTO profiles (user_id) VALUES ($1)', [user.id]);

    // Create free subscription
    await query(
      "INSERT INTO subscriptions (user_id, plan, status) VALUES ($1, 'free', 'active')",
      [user.id]
    );

    // Send verification email (non-blocking)
    sendVerificationEmail(email, name, verification_token).catch(console.error);

    const tokens = generateTokens(user.id);

    res.status(201).json({
      message: 'Account created! Please verify your email.',
      user: formatUser(user),
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: 'Validation failed', details: errors.array() });
    }

    const { email, password } = req.body;

    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ error: `Please sign in with ${user.provider}` });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tokens = generateTokens(user.id);

    res.json({
      user: formatUser(user),
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────
exports.logout = async (req, res) => {
  // Client should delete stored tokens
  // Add token to blocklist here if needed
  res.json({ message: 'Logged out successfully' });
};

// ─────────────────────────────────────────────
// REFRESH TOKEN
// ─────────────────────────────────────────────
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const tokens  = generateTokens(decoded.userId);

    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

// ─────────────────────────────────────────────
// VERIFY EMAIL
// ─────────────────────────────────────────────
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await query(
      `UPDATE users SET email_verified = TRUE, verification_token = NULL
       WHERE verification_token = $1 RETURNING id`,
      [token]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    res.json({ message: 'Email verified successfully!' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const result = await query('SELECT id, name FROM users WHERE email = $1', [email]);
    if (!result.rows.length) {
      // Don't reveal if email exists
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const user  = result.rows[0];
    const token = uuidv4();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [token, expires, user.id]
    );

    sendPasswordResetEmail(email, user.name, token).catch(console.error);

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: 'Validation failed', details: errors.array() });
    }

    const { token, password } = req.body;

    const result = await query(
      `SELECT id FROM users
       WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const password_hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    await query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL
       WHERE id = $2`,
      [password_hash, result.rows[0].id]
    );

    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GOOGLE OAUTH
// ─────────────────────────────────────────────
exports.googleOAuth = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    // Verify with Google API (production would use google-auth-library)
    // const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    // const payload = ticket.getPayload();
    
    // Simulated payload for structure:
    const payload = { sub: 'google_' + Date.now(), email: req.body.email, name: req.body.name, picture: req.body.picture };

    let result = await query('SELECT * FROM users WHERE provider_id = $1 AND provider = $2', [payload.sub, 'google']);

    if (!result.rows.length) {
      result = await query(
        `INSERT INTO users (email, name, avatar_url, provider, provider_id, email_verified)
         VALUES ($1, $2, $3, 'google', $4, TRUE)
         ON CONFLICT (email) DO UPDATE SET provider = 'google', provider_id = $4, email_verified = TRUE
         RETURNING *`,
        [payload.email, payload.name, payload.picture, payload.sub]
      );
      // Create profile + subscription for new users
      await query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [result.rows[0].id]);
      await query("INSERT INTO subscriptions (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [result.rows[0].id]);
    }

    const user   = result.rows[0];
    const tokens = generateTokens(user.id);

    res.json({ user: formatUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// APPLE OAUTH
// ─────────────────────────────────────────────
exports.appleOAuth = async (req, res, next) => {
  try {
    const { identityToken, user: appleUser } = req.body;
    // Production: verify identityToken with Apple's public keys
    const payload = { sub: 'apple_' + Date.now(), email: appleUser?.email, name: appleUser?.name?.firstName || 'Apple User' };

    let result = await query('SELECT * FROM users WHERE provider_id = $1 AND provider = $2', [payload.sub, 'apple']);

    if (!result.rows.length) {
      result = await query(
        `INSERT INTO users (email, name, provider, provider_id, email_verified)
         VALUES ($1, $2, 'apple', $3, TRUE)
         ON CONFLICT (email) DO UPDATE SET provider_id = $3
         RETURNING *`,
        [payload.email, payload.name, payload.sub]
      );
      await query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [result.rows[0].id]);
      await query("INSERT INTO subscriptions (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [result.rows[0].id]);
    }

    const user   = result.rows[0];
    const tokens = generateTokens(user.id);

    res.json({ user: formatUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET ME
// ─────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.name, u.avatar_url, u.provider, u.email_verified,
              p.gender, p.age, p.height_cm, p.weight_kg, p.fitness_level, p.workout_days, p.primary_goal,
              s.plan as subscription_plan, s.status as subscription_status
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
