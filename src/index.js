require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'SmartWorkout AI is running!',
    timestamp: new Date().toISOString() 
  });
});

// Routes
try {
  const authRoutes = require('./routes/auth.routes');
  app.use('/api/auth', authRoutes);
} catch(e) { console.log('Auth routes not loaded:', e.message); }

try {
  const profileRoutes = require('./routes/profile.routes');
  app.use('/api/profile', profileRoutes);
} catch(e) { console.log('Profile routes not loaded:', e.message); }

try {
  const workoutRoutes = require('./routes/workout.routes');
  app.use('/api/workouts', workoutRoutes);
} catch(e) { console.log('Workout routes not loaded:', e.message); }

try {
  const logRoutes = require('./routes/log.routes');
  app.use('/api/logs', logRoutes);
} catch(e) { console.log('Log routes not loaded:', e.message); }

try {
  const aiRoutes = require('./routes/ai.routes');
  app.use('/api/ai', aiRoutes);
} catch(e) { console.log('AI routes not loaded:', e.message); }

try {
  const mealRoutes = require('./routes/meal.routes');
  app.use('/api/meals', mealRoutes);
} catch(e) { console.log('Meal routes not loaded:', e.message); }

try {
  const stripeRoutes = require('./routes/stripe.routes');
  app.use('/api/stripe', stripeRoutes);
} catch(e) { console.log('Stripe routes not loaded:', e.message); }

try {
  const videoRoutes = require('./routes/video.routes');
  app.use('/api/videos', videoRoutes);
} catch(e) { console.log('Video routes not loaded:', e.message); }

try {
  const challengeRoutes = require('./routes/challenge.routes');
  app.use('/api/challenges', challengeRoutes);
} catch(e) { console.log('Challenge routes not loaded:', e.message); }

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`
🚀 SmartWorkout AI running on port ${PORT}
✅ Server is ready!
  `);
});

module.exports = app;

https://smartworkout-backend.onrender.com/health
