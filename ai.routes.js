// ============================================================
// SMARTWORKOUT AI — AI Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/ai.controller');
const { authenticate, requirePro } = require('../middleware/auth.middleware');

router.use(authenticate);

// Free tier: basic chat (limited)
router.post('/chat',       ctrl.chat);

// Pro only
router.post('/meal-plan',  requirePro, ctrl.generateMealPlan);
router.post('/body-scan',  requirePro, ctrl.bodyScan);

module.exports = router;

// ============================================================
// SMARTWORKOUT AI — AI Controller
// ============================================================
// (Inline for brevity — can split to controllers/ai.controller.js)
