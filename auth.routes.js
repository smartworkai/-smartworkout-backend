// ============================================================
// SMARTWORKOUT AI — Auth Routes
// ============================================================
const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();
const ctrl    = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Validation rules
const signupRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().isLength({ max: 100 }),
];

const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// POST /api/auth/signup
router.post('/signup', signupRules, ctrl.signup);

// POST /api/auth/login
router.post('/login', loginRules, ctrl.login);

// POST /api/auth/logout
router.post('/logout', authenticate, ctrl.logout);

// POST /api/auth/refresh
router.post('/refresh', ctrl.refreshToken);

// POST /api/auth/forgot-password
router.post('/forgot-password', [body('email').isEmail()], ctrl.forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
], ctrl.resetPassword);

// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', ctrl.verifyEmail);

// POST /api/auth/oauth/google
router.post('/oauth/google', ctrl.googleOAuth);

// POST /api/auth/oauth/apple
router.post('/oauth/apple', ctrl.appleOAuth);

// GET /api/auth/me
router.get('/me', authenticate, ctrl.getMe);

module.exports = router;
