// ============================================================
// SMARTWORKOUT AI — Meal Routes
// ============================================================
const express  = require('express');
const mealRouter = express.Router();
const { authenticate, requirePro } = require('../middleware/auth.middleware');
const { query } = require('../utils/db');

mealRouter.use(authenticate);

mealRouter.get('/', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const result = await query(
      'SELECT * FROM meals WHERE user_id = $1 AND plan_date = $2 ORDER BY meal_type',
      [req.user.id, date]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports.mealRouter = mealRouter;

// ============================================================
// SMARTWORKOUT AI — Scan Routes
// ============================================================
const scanRouter = express.Router();
scanRouter.use(authenticate);

scanRouter.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM body_scans WHERE user_id = $1 ORDER BY scanned_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports.scanRouter = scanRouter;

// ============================================================
// SMARTWORKOUT AI — Video Routes
// ============================================================
const videoRouter = express.Router();
videoRouter.use(authenticate);

videoRouter.get('/', async (req, res, next) => {
  try {
    const { muscle_group, limit = 20, offset = 0 } = req.query;
    let sql    = 'SELECT * FROM videos WHERE is_active = TRUE';
    let params = [];

    if (muscle_group) {
      sql += ' AND muscle_group = $1';
      params.push(muscle_group);
    }

    sql += ` ORDER BY views DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

videoRouter.post('/:id/like', async (req, res, next) => {
  try {
    await query(
      `INSERT INTO video_interactions (user_id, video_id, action)
       VALUES ($1, $2, 'like') ON CONFLICT DO NOTHING`,
      [req.user.id, req.params.id]
    );
    await query("UPDATE videos SET likes = likes + 1 WHERE id = $1", [req.params.id]);
    res.json({ liked: true });
  } catch (err) { next(err); }
});

videoRouter.post('/:id/save', async (req, res, next) => {
  try {
    await query(
      `INSERT INTO video_interactions (user_id, video_id, action)
       VALUES ($1, $2, 'save') ON CONFLICT DO NOTHING`,
      [req.user.id, req.params.id]
    );
    res.json({ saved: true });
  } catch (err) { next(err); }
});

module.exports.videoRouter = videoRouter;

// ============================================================
// SMARTWORKOUT AI — Challenge Routes
// ============================================================
const challengeRouter = express.Router();
challengeRouter.use(authenticate);

challengeRouter.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*,
              cp.progress AS user_progress,
              cp.completed AS user_completed,
              cp.joined_at,
              COUNT(cp2.id) AS participant_count
       FROM challenges c
       LEFT JOIN challenge_participants cp  ON cp.challenge_id = c.id AND cp.user_id = $1
       LEFT JOIN challenge_participants cp2 ON cp2.challenge_id = c.id
       WHERE c.is_active = TRUE AND c.ends_at > NOW()
       GROUP BY c.id, cp.progress, cp.completed, cp.joined_at
       ORDER BY c.starts_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

challengeRouter.post('/:id/join', async (req, res, next) => {
  try {
    await query(
      `INSERT INTO challenge_participants (challenge_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id]
    );
    res.json({ joined: true });
  } catch (err) { next(err); }
});

challengeRouter.get('/leaderboard', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.avatar_url,
              COUNT(DISTINCT DATE(wl.logged_at)) AS workout_days,
              COALESCE(SUM(wl.calories_burned), 0) AS total_calories,
              ROW_NUMBER() OVER (ORDER BY COUNT(DISTINCT DATE(wl.logged_at)) DESC) AS rank
       FROM users u
       LEFT JOIN workout_logs wl ON wl.user_id = u.id AND wl.logged_at > NOW() - INTERVAL '30 days'
       WHERE u.is_active = TRUE
       GROUP BY u.id
       ORDER BY workout_days DESC
       LIMIT 50`,
      []
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports.challengeRouter = challengeRouter;
