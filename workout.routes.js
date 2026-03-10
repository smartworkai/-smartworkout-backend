// ============================================================
// SMARTWORKOUT AI — Workout Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/workout.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post('/generate',     ctrl.generateWorkout);   // POST /api/workouts/generate
router.get('/today',         ctrl.getTodayWorkout);   // GET  /api/workouts/today
router.get('/program',       ctrl.getProgram);        // GET  /api/workouts/program
router.get('/:id',           ctrl.getWorkout);        // GET  /api/workouts/:id
router.patch('/:id/complete', ctrl.completeWorkout);  // PATCH /api/workouts/:id/complete

module.exports = router;
