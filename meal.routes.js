// meal.routes.js
const express = require('express');
const router  = express.Router();
const { authenticate, requirePro } = require('../middleware/auth.middleware');
const { query } = require('../utils/db');
router.use(authenticate);
router.get('/', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const r = await query('SELECT * FROM meals WHERE user_id=$1 AND plan_date=$2 ORDER BY meal_type',[req.user.id, date]);
    res.json(r.rows);
  } catch(err){next(err);}
});
module.exports = router;
