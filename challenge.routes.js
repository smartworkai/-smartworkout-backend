const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query } = require('../utils/db');
router.use(authenticate);
router.get('/', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT c.*, cp.progress AS user_progress, COUNT(cp2.id) AS participant_count
       FROM challenges c
       LEFT JOIN challenge_participants cp  ON cp.challenge_id=c.id AND cp.user_id=$1
       LEFT JOIN challenge_participants cp2 ON cp2.challenge_id=c.id
       WHERE c.is_active=TRUE AND c.ends_at>NOW()
       GROUP BY c.id, cp.progress ORDER BY c.starts_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch(err){next(err);}
});
router.post('/:id/join', async (req, res, next) => {
  try {
    await query(`INSERT INTO challenge_participants (challenge_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,[req.params.id,req.user.id]);
    res.json({joined:true});
  } catch(err){next(err);}
});
router.get('/leaderboard', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT u.id,u.name,u.avatar_url,
              COUNT(DISTINCT DATE(wl.logged_at)) AS workout_days,
              COALESCE(SUM(wl.calories_burned),0) AS total_calories
       FROM users u
       LEFT JOIN workout_logs wl ON wl.user_id=u.id AND wl.logged_at>NOW()-INTERVAL '30 days'
       WHERE u.is_active=TRUE GROUP BY u.id
       ORDER BY workout_days DESC LIMIT 50`,[]
    );
    res.json(r.rows);
  } catch(err){next(err);}
});
module.exports = router;
