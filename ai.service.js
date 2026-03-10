// ============================================================
// SMARTWORKOUT AI — AI Service (OpenAI)
// ============================================================
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─────────────────────────────────────────────
// AI CHAT — Personal Trainer
// ─────────────────────────────────────────────
exports.chatWithTrainer = async ({ userMessage, profile, history = [] }) => {
  const systemPrompt = `You are an elite AI personal trainer inside SmartWorkout AI.

User Profile:
- Gender: ${profile.gender}
- Age: ${profile.age}
- Goal: ${profile.primary_goal}
- Fitness Level: ${profile.fitness_level}
- Height: ${profile.height_cm}cm | Weight: ${profile.weight_kg}kg

Your role:
- Give expert, personalized fitness and nutrition advice
- Explain exercise form with precision
- Suggest workout adjustments based on the user's goals
- Be motivating but realistic
- Keep responses concise (2-4 sentences max) unless asked for detail
- Use emojis sparingly for energy 💪

NEVER give medical diagnoses. Recommend seeing a doctor for injuries.`;

  const messages = [
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    max_tokens: 400,
    temperature: 0.7,
  });

  return response.choices[0].message.content;
};

// ─────────────────────────────────────────────
// AI MEAL PLAN GENERATOR
// ─────────────────────────────────────────────
exports.generateMealPlan = async ({ profile }) => {
  const tdee   = calculateTDEE(profile);
  const target = profile.primary_goal === 'lose_fat' ? tdee - 400 : tdee + 200;

  const prompt = `Generate a 1-day meal plan for this person:
- Goal: ${profile.primary_goal}
- Weight: ${profile.weight_kg}kg | Height: ${profile.height_cm}cm
- Daily calorie target: ${target} kcal
- Diet preference: ${profile.diet_pref || 'none'}

Return ONLY valid JSON in this exact format:
{
  "daily_calories": ${target},
  "daily_protein_g": number,
  "daily_carbs_g": number,
  "daily_fat_g": number,
  "meals": [
    {
      "meal_type": "breakfast",
      "name": "string",
      "description": "string",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "prep_time_min": number
    }
  ]
}

Include breakfast, lunch, dinner, and 1-2 snacks. Make meals practical and delicious.`;

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1200,
    temperature: 0.6,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
};

// ─────────────────────────────────────────────
// AI WORKOUT GENERATOR (AI-enhanced)
// ─────────────────────────────────────────────
exports.generateWorkoutWithAI = async ({ profile, dayFocus }) => {
  const prompt = `Create a workout for:
- Goal: ${profile.primary_goal}
- Level: ${profile.fitness_level}
- Focus: ${dayFocus}
- Available equipment: gym

Return ONLY valid JSON:
{
  "exercises": [
    {
      "name": "string",
      "sets": number,
      "reps": "string",
      "rest_seconds": number,
      "coaching_tip": "string"
    }
  ],
  "estimated_duration_min": number,
  "warmup": ["exercise 1", "exercise 2"],
  "cooldown": ["stretch 1", "stretch 2"]
}`;

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
};

// ─────────────────────────────────────────────
// AI BODY SCAN ANALYSIS
// ─────────────────────────────────────────────
exports.analyzeBodyScan = async ({ imageBase64, profile }) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' },
        },
        {
          type: 'text',
          text: `Analyze this body photo for fitness assessment. User: ${profile.gender}, ${profile.age}yo, goal: ${profile.primary_goal}.
          
          Return ONLY valid JSON:
          {
            "body_fat_estimate_pct": number,
            "muscle_distribution": "string",
            "posture_notes": "string",
            "symmetry_score": number (1-10),
            "strengths": ["string"],
            "areas_to_improve": ["string"],
            "recommendations": ["string"]
          }`,
        },
      ],
    }],
    max_tokens: 600,
  });

  return JSON.parse(response.choices[0].message.content);
};

// ─────────────────────────────────────────────
// TDEE CALCULATOR
// ─────────────────────────────────────────────
function calculateTDEE(profile) {
  const { weight_kg: w, height_cm: h, age, gender, fitness_level } = profile;

  // Mifflin-St Jeor BMR
  let bmr = gender === 'female'
    ? (10 * w) + (6.25 * h) - (5 * age) - 161
    : (10 * w) + (6.25 * h) - (5 * age) + 5;

  const activityMultipliers = {
    beginner:     1.375,
    intermediate: 1.55,
    advanced:     1.725,
  };

  return Math.round(bmr * (activityMultipliers[fitness_level] || 1.55));
}
