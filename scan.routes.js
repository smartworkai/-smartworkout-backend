const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query } = require('../utils/db');
router.use(authenticate);
router.get('/', async (req, res, next) => {
  try {
    const r = await query('SELECT * FROM body_scans WHERE user_id=$1 ORDER BY scanned_at DESC LIMIT 20',[req.user.id]);
    res.json(r.rows);
  } catch(err){next(err);}
});
module.exports = router;
