// ============================================================
// SMARTWORKOUT AI — Stripe Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/stripe.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Webhook — raw body (registered before json middleware in index.js)
router.post('/webhook', ctrl.handleWebhook);

// Protected routes
router.use(authenticate);

router.post('/create-checkout',   ctrl.createCheckout);   // POST /api/stripe/create-checkout
router.post('/create-portal',     ctrl.createPortal);     // POST /api/stripe/create-portal
router.get('/subscription',       ctrl.getSubscription);  // GET  /api/stripe/subscription
router.post('/cancel',            ctrl.cancelSubscription); // POST /api/stripe/cancel

module.exports = router;
