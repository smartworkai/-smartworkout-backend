// ============================================================
// SMARTWORKOUT AI — Workout Controller
// ============================================================
const { query, getClient } = require('../utils/db');
const { generateWorkoutWithAI } = require('../services/ai.service');

// ─────────────────────────────────────────────
// PROGRAM TEMPLATES
// ─────────────────────────────────────────────
const PROGRAMS = {
  bbl: {
    name: 'BBL Glute Builder',
    days: [
      { day: 'Day 1', focus: 'Glute Activation', slugs: ['hip-thrust','romanian-deadlift','glute-bridge','cable-kickbacks'] },
      { day: 'Day 2', focus: 'Core + Cardio',    slugs: ['plank','bicycle-crunches','stair-climber'] },
      { day: 'Day 3', focus: 'Glutes + Quads',   slugs: ['sumo-squat','walking-lunges','leg-press'] },
      { day: 'Day 5', focus: 'Heavy Glute Day',  slugs: ['hip-thrust','single-leg-rdl','abductor-machine'] },
    ],
  },
  ppl: {
    name: 'Push Pull Legs',
    days: [
      { day: 'Push', focus: 'Chest + Shoulders + Triceps', slugs: ['bench-press','overhead-press','incline-db-press','tricep-pushdown'] },
      { day: 'Pull', focus: 'Back + Biceps',               slugs: ['barbell-row','pull-ups','face-pull','barbell-curl'] },
      { day: 'Legs', focus: 'Quads + Hamstrings + Calves', slugs: ['squat','romanian-deadlift','leg-extension','calf-raise'] },
    ],
  },
  fat_loss: {
    name: 'Fat Loss Program',
    days: [
      { day: 'Day 1', focus: 'Full Body Circuit A', slugs: ['squat','bench-press','barbell-row','plank'] },
      { day: 'Day 2', focus: 'Cardio + Core',       slugs: ['stair-climber','bicycle-crunches','plank'] },
      { day: 'Day 3', focus: 'Full Body Circuit B', slugs: ['romanian-deadlift','overhead-press','pull-ups','walking-lunges'] },
      { day: 'Day 4', focus: 'HIIT + Abs',          slugs: ['stair-climber','bicycle-crunches','plank'] },
    ],
  },
  strength: {
    name: 'Strength Training',
    days: [
      { day: 'Day 1', focus: 'Lower Body Power', slugs: ['squat','romanian-deadlift','leg-press','calf-raise'] },
      { day: 'Day 2', focus: 'Upper Body Push',  slugs: ['bench-press','overhead-press','incline-db-press','tricep-pushdown'] },
      { day: 'Day 3', focus: 'Upper Body Pull',  slugs: ['barbell-row','pull-ups','barbell-curl','face-pull'] },
    ],
  },
  lean_toning: {
    name: 'Lean Toning',
    days: [
      { day: 'Day 1', focus: 'Lower Tone',  slugs: ['sumo-squat','glute-bridge','leg-extension','calf-raise'] },
      { day: 'Day 2', focus: 'Upper Tone',  slugs: ['incline-db-press','barbell-row','face-pull','tricep-pushdown'] },
      { day: 'Day 3', focus: 'Core + Cardio', slugs: ['plank','bicycle-crunches','stair-climber'] },
    ],
  },
};

const GOAL_TO_PROGRAM = {
  bbl:              'bbl',
  build_muscle:     'ppl',
  lose_fat:         'fat_loss',
  strength:         'strength',
  lean_toning:      'lean_toning',
  athletic:         'ppl',
};

// ─────────────────────────────────────────────
// GENERATE WORKOUT PROGRAM
// ─────────────────────────────────────────────
exports.generateWorkout = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const profileResult = await client.query(
      'SELECT * FROM profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (!profileResult.rows.length) {
      return res.status(400).json({ error: 'Profile not found. Complete your profile first.' });
    }

    const profile     = profileResult.rows[0];
    const programKey  = GOAL_TO_PROGRAM[profile.primary_goal] || 'ppl';
    const program     = PROGRAMS[programKey];
    const weekNumber  = (req.body.week || 1);
    const startDate   = new Date();

    // Delete existing program workouts for this week
    await client.query(
      "DELETE FROM workouts WHERE user_id = $1 AND week_number = $2 AND is_ai_generated = TRUE",
      [req.user.id, weekNumber]
    );

    const createdWorkouts = [];

    for (let i = 0; i < program.days.length; i++) {
      const day = program.days[i];

      // Schedule workouts on workout days
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(startDate.getDate() + (i * Math.ceil(7 / program.days.length)));

      // Create workout
      const wResult = await client.query(
        `INSERT INTO workouts
           (user_id, name, program_type, week_number, day_label, focus, duration_min, is_ai_generated, scheduled_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
         RETURNING *`,
        [req.user.id, `${program.name} — ${day.day}`, programKey, weekNumber, day.day, day.focus, 45, scheduledDate.toISOString().split('T')[0]]
      );

      const workout = wResult.rows[0];

      // Attach exercises
      for (let pos = 0; pos < day.slugs.length; pos++) {
        const exResult = await client.query(
          'SELECT id FROM exercises WHERE slug = $1',
          [day.slugs[pos]]
        );
        if (!exResult.rows.length) continue;

        const exerciseId = exResult.rows[0].id;
        await client.query(
          `INSERT INTO workout_exercises (workout_id, exercise_id, position, sets, reps)
           VALUES ($1, $2, $3, $4, $5)`,
          [workout.id, exerciseId, pos + 1, 3, '10-12']
        );
      }

      createdWorkouts.push(workout);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `${program.name} program created for week ${weekNumber}!`,
      program: program.name,
      workouts: createdWorkouts,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// GET TODAY'S WORKOUT
// ─────────────────────────────────────────────
exports.getTodayWorkout = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const result = await query(
      `SELECT w.*,
              json_agg(
                json_build_object(
                  'id', we.id,
                  'position', we.position,
                  'sets', we.sets,
                  'reps', we.reps,
                  'weight_kg', we.weight_kg,
                  'exercise', json_build_object(
                    'id', e.id,
                    'name', e.name,
                    'slug', e.slug,
                    'muscle_group', e.muscle_group,
                    'difficulty', e.difficulty,
                    'equipment', e.equipment,
                    'instructions', e.instructions,
                    'video_url', e.video_url
                  )
                ) ORDER BY we.position
              ) AS exercises
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
       JOIN exercises e ON e.id = we.exercise_id
       WHERE w.user_id = $1 AND w.scheduled_date = $2
       GROUP BY w.id`,
      [req.user.id, today]
    );

    if (!result.rows.length) {
      return res.json({ workout: null, message: 'No workout scheduled for today. Enjoy your rest day! 💆' });
    }

    res.json({ workout: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET FULL PROGRAM
// ─────────────────────────────────────────────
exports.getProgram = async (req, res, next) => {
  try {
    const week = req.query.week || 1;

    const result = await query(
      `SELECT w.id, w.name, w.day_label, w.focus, w.duration_min, w.is_completed, w.scheduled_date,
              COUNT(we.id) AS exercise_count
       FROM workouts w
       LEFT JOIN workout_exercises we ON we.workout_id = w.id
       WHERE w.user_id = $1 AND w.week_number = $2
       GROUP BY w.id
       ORDER BY w.scheduled_date`,
      [req.user.id, week]
    );

    res.json({ week: parseInt(week), workouts: result.rows });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET SINGLE WORKOUT
// ─────────────────────────────────────────────
exports.getWorkout = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT w.*,
              json_agg(
                json_build_object(
                  'id', we.id, 'position', we.position,
                  'sets', we.sets, 'reps', we.reps, 'weight_kg', we.weight_kg,
                  'rest_seconds', we.rest_seconds,
                  'exercise', json_build_object(
                    'id', e.id, 'name', e.name, 'slug', e.slug,
                    'muscle_group', e.muscle_group, 'difficulty', e.difficulty,
                    'equipment', e.equipment, 'instructions', e.instructions,
                    'tips', e.tips, 'video_url', e.video_url
                  )
                ) ORDER BY we.position
              ) AS exercises
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
       JOIN exercises e ON e.id = we.exercise_id
       WHERE w.id = $1 AND w.user_id = $2
       GROUP BY w.id`,
      [req.params.id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// COMPLETE WORKOUT
// ─────────────────────────────────────────────
exports.completeWorkout = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE workouts SET is_completed = TRUE
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    res.json({ message: 'Workout completed! 🎉', workout: result.rows[0] });
  } catch (err) {
    next(err);
  }
};
