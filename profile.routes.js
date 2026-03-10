// ============================================================
// SMARTWORKOUT AI — Profile Routes
// ============================================================
const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query } = require('../utils/db');

router.use(authenticate);

// GET /api/profile
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.*, u.name, u.email, u.avatar_url,
              s.plan AS subscription_plan, s.status AS subscription_status
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN subscriptions s ON s.user_id = p.user_id
       WHERE p.user_id = $1`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/profile
router.put('/', [
  body('gender').optional().isIn(['male', 'female', 'non-binary']),
  body('age').optional().isInt({ min: 13, max: 100 }),
  body('height_cm').optional().isFloat({ min: 100, max: 250 }),
  body('weight_kg').optional().isFloat({ min: 30, max: 300 }),
  body('fitness_level').optional().isIn(['beginner', 'intermediate', 'advanced']),
  body('workout_days').optional().isInt({ min: 1, max: 7 }),
  body('primary_goal').optional().isIn(['bbl', 'build_muscle', 'lose_fat', 'strength', 'athletic', 'lean_toning']),
], async (req, res, next) => {
  try {
    const { gender, age, height_cm, weight_kg, fitness_level, workout_days, primary_goal, diet_pref } = req.body;

    const result = await query(
      `UPDATE profiles SET
         gender = COALESCE($1, gender),
         age = COALESCE($2, age),
         height_cm = COALESCE($3, height_cm),
         weight_kg = COALESCE($4, weight_kg),
         fitness_level = COALESCE($5, fitness_level),
         workout_days = COALESCE($6, workout_days),
         primary_goal = COALESCE($7, primary_goal),
         diet_pref = COALESCE($8, diet_pref),
         updated_at = NOW()
       WHERE user_id = $9
       RETURNING *`,
      [gender, age, height_cm, weight_kg, fitness_level, workout_days, primary_goal, diet_pref, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/profile/metrics — body measurements history
router.get('/metrics', async (req, res, next) => {
  try {
    const { limit = 30 } = req.query;
    const result = await query(
      `SELECT * FROM body_metrics WHERE user_id = $1
       ORDER BY measured_at DESC LIMIT $2`,
      [req.user.id, parseInt(limit)]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/profile/metrics — log body measurements
router.post('/metrics', async (req, res, next) => {
  try {
    const { weight_kg, waist_cm, chest_cm, hips_cm, arms_cm, glutes_cm, body_fat_pct } = req.body;

    const result = await query(
      `INSERT INTO body_metrics (user_id, weight_kg, waist_cm, chest_cm, hips_cm, arms_cm, glutes_cm, body_fat_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, weight_kg, waist_cm, chest_cm, hips_cm, arms_cm, glutes_cm, body_fat_pct]
    );

    // Also update profile weight
    if (weight_kg) {
      await query('UPDATE profiles SET weight_kg = $1 WHERE user_id = $2', [weight_kg, req.user.id]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
