// ============================================================
// SMARTWORKOUT AI — Email Service (Nodemailer)
// ============================================================
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `${process.env.APP_NAME} <${process.env.EMAIL_FROM}>`;
const FRONTEND = process.env.FRONTEND_URL;

exports.sendVerificationEmail = async (email, name, token) => {
  const url = `${FRONTEND}/auth/verify-email/${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: '✅ Verify your SmartWorkout AI email',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Welcome, ${name}! 💪</h2>
        <p>Click below to verify your email and start your fitness journey.</p>
        <a href="${url}" style="display:inline-block;background:#c8f135;color:#050508;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">
          Verify Email →
        </a>
        <p style="color:#666;font-size:12px">Link expires in 24 hours. If you didn't create an account, ignore this email.</p>
      </div>
    `,
  });
};

exports.sendPasswordResetEmail = async (email, name, token) => {
  const url = `${FRONTEND}/auth/reset-password?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: '🔐 Reset your SmartWorkout AI password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Password Reset</h2>
        <p>Hi ${name}, click below to reset your password.</p>
        <a href="${url}" style="display:inline-block;background:#c8f135;color:#050508;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">
          Reset Password →
        </a>
        <p style="color:#666;font-size:12px">This link expires in 1 hour.</p>
      </div>
    `,
  });
};

exports.sendWorkoutReminder = async (email, name, workoutName) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `💪 Time to train! ${workoutName} is waiting`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Workout Reminder 🔥</h2>
        <p>Hey ${name}! Your <strong>${workoutName}</strong> is scheduled for today.</p>
        <a href="${FRONTEND}/workouts" style="display:inline-block;background:#c8f135;color:#050508;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700">
          Start Workout →
        </a>
      </div>
    `,
  });
};
