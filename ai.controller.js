// ============================================================
// SMARTWORKOUT AI — AI Controller
// ============================================================
const { query } = require('../utils/db');
const aiService = require('../services/ai.service');

// ─────────────────────────────────────────────
// CHAT WITH AI TRAINER
// ─────────────────────────────────────────────
exports.chat = async (req, res, next) => {
  try {
    const { message, history } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get user profile for context
    const profileResult = await query('SELECT * FROM profiles WHERE user_id = $1', [req.user.id]);
    const profile = profileResult.rows[0] || {};

    const reply = await aiService.chatWithTrainer({
      userMessage: message,
      profile,
      history: history || [],
    });

    res.json({ reply });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GENERATE MEAL PLAN
// ─────────────────────────────────────────────
exports.generateMealPlan = async (req, res, next) => {
  try {
    const profileResult = await query('SELECT * FROM profiles WHERE user_id = $1', [req.user.id]);
    const profile = profileResult.rows[0];

    if (!profile) {
      return res.status(400).json({ error: 'Complete your profile first' });
    }

    const mealPlan = await aiService.generateMealPlan({ profile });

    // Save meals to DB
    const today = new Date().toISOString().split('T')[0];

    // Remove existing meals for today
    await query('DELETE FROM meals WHERE user_id = $1 AND plan_date = $2', [req.user.id, today]);

    for (const meal of mealPlan.meals) {
      await query(
        `INSERT INTO meals (user_id, plan_date, meal_type, name, description, calories, protein_g, carbs_g, fat_g)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [req.user.id, today, meal.meal_type, meal.name, meal.description, meal.calories, meal.protein_g, meal.carbs_g, meal.fat_g]
      );
    }

    res.json(mealPlan);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// BODY SCAN ANALYSIS
// ─────────────────────────────────────────────
exports.bodyScan = async (req, res, next) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data required' });
    }

    const profileResult = await query('SELECT * FROM profiles WHERE user_id = $1', [req.user.id]);
    const profile = profileResult.rows[0] || {};

    const analysis = await aiService.analyzeBodyScan({ imageBase64, profile });

    // Save scan result
    await query(
      `INSERT INTO body_scans (user_id, body_fat_pct, posture_score, symmetry_pct, analysis_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        analysis.body_fat_estimate_pct,
        analysis.symmetry_score,
        analysis.symmetry_score * 10,
        JSON.stringify(analysis),
      ]
    );

    res.json(analysis);
  } catch (err) {
    next(err);
  }
};
