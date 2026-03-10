// video.routes.js
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query } = require('../utils/db');
router.use(authenticate);
router.get('/', async (req, res, next) => {
  try {
    const { muscle_group, limit=20, offset=0 } = req.query;
    let sql='SELECT * FROM videos WHERE is_active=TRUE', params=[];
    if(muscle_group){ sql+=' AND muscle_group=$1'; params.push(muscle_group); }
    sql+=` ORDER BY views DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));
    const r = await query(sql, params);
    res.json(r.rows);
  } catch(err){next(err);}
});
router.post('/:id/like', async (req, res, next) => {
  try {
    await query(`INSERT INTO video_interactions (user_id,video_id,action) VALUES ($1,$2,'like') ON CONFLICT DO NOTHING`,[req.user.id,req.params.id]);
    await query("UPDATE videos SET likes=likes+1 WHERE id=$1",[req.params.id]);
    res.json({liked:true});
  } catch(err){next(err);}
});
router.post('/:id/save', async (req, res, next) => {
  try {
    await query(`INSERT INTO video_interactions (user_id,video_id,action) VALUES ($1,$2,'save') ON CONFLICT DO NOTHING`,[req.user.id,req.params.id]);
    res.json({saved:true});
  } catch(err){next(err);}
});
module.exports = router;
