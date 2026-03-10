// ============================================================
// SMARTWORKOUT AI — Workout Log Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query } = require('../utils/db');

router.use(authenticate);

// POST /api/logs — log a set
router.post('/', async (req, res, next) => {
  try {
    const { workout_id, exercise_id, set_number, reps_completed, weight_kg, duration_sec, calories_burned, rpe } = req.body;

    const result = await query(
      `INSERT INTO workout_logs
         (user_id, workout_id, exercise_id, set_number, reps_completed, weight_kg, duration_sec, calories_burned, rpe)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, workout_id, exercise_id, set_number, reps_completed, weight_kg, duration_sec, calories_burned, rpe]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/logs — workout history
router.get('/', async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(
      `SELECT wl.*, e.name AS exercise_name, e.muscle_group
       FROM workout_logs wl
       JOIN exercises e ON e.id = wl.exercise_id
       WHERE wl.user_id = $1
       ORDER BY wl.logged_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/logs/stats — aggregated stats
router.get('/stats', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         COUNT(DISTINCT DATE(logged_at))                       AS total_workout_days,
         COUNT(*)                                              AS total_sets,
         COALESCE(SUM(calories_burned), 0)                    AS total_calories_burned,
         COALESCE(SUM(weight_kg * reps_completed), 0)         AS total_volume_kg,
         MAX(DATE(logged_at))                                  AS last_workout_date,
         COUNT(DISTINCT DATE_TRUNC('week', logged_at))         AS total_weeks_active
       FROM workout_logs
       WHERE user_id = $1`,
      [req.user.id]
    );

    // Current streak
    const streakResult = await query(
      `WITH daily AS (
         SELECT DISTINCT DATE(logged_at) AS d
         FROM workout_logs WHERE user_id = $1
         ORDER BY d DESC
       ),
       numbered AS (
         SELECT d, ROW_NUMBER() OVER (ORDER BY d DESC) AS rn FROM daily
       )
       SELECT COUNT(*) AS streak
       FROM numbered
       WHERE d >= CURRENT_DATE - (rn - 1)`,
      [req.user.id]
    );

    res.json({
      ...result.rows[0],
      current_streak: parseInt(streakResult.rows[0]?.streak || 0),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
