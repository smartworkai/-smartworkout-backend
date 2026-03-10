// ============================================================
// SMARTWORKOUT AI — Express Server Entry Point
// ============================================================
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const compression = require('compression');
const rateLimit  = require('express-rate-limit');

// Routes
const authRoutes     = require('./routes/auth.routes');
const profileRoutes  = require('./routes/profile.routes');
const workoutRoutes  = require('./routes/workout.routes');
const logRoutes      = require('./routes/log.routes');
const aiRoutes       = require('./routes/ai.routes');
const mealRoutes     = require('./routes/meal.routes');
const scanRoutes     = require('./routes/scan.routes');
const stripeRoutes   = require('./routes/stripe.routes');
const videoRoutes    = require('./routes/video.routes');
const challengeRoutes = require('./routes/challenge.routes');

const { errorHandler } = require('./middleware/error.middleware');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Stripe webhooks need raw body — register BEFORE json parser
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter limiter for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts, please try again in 15 minutes.' },
});

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────
app.use('/api/auth',       authLimiter, authRoutes);
app.use('/api/profile',    profileRoutes);
app.use('/api/workouts',   workoutRoutes);
app.use('/api/logs',       logRoutes);
app.use('/api/ai',         aiRoutes);
app.use('/api/meals',      mealRoutes);
app.use('/api/scans',      scanRoutes);
app.use('/api/stripe',     stripeRoutes);
app.use('/api/videos',     videoRoutes);
app.use('/api/challenges', challengeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────
// 404 + ERROR HANDLING
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.use(errorHandler);

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 SmartWorkout AI API running on port ${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

module.exports = app;
