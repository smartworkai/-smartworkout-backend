javascriptconst Groq = require('groq-sdk');
const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY 
});

exports.chatWithTrainer = async ({ 
  userMessage, profile, history = [] 
}) => {
  const systemPrompt = `You are an elite AI personal trainer.
User: ${profile.gender}, ${profile.age} years old
Goal: ${profile.primary_goal}
Level: ${profile.fitness_level}
Weight: ${profile.weight_kg}kg
Height: ${profile.height_cm}cm
Give short helpful fitness advice. Never diagnose injuries.`;

  const response = await groq.chat.completions.create({
    model: 'llama3-8b-8192',
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(m => ({ 
        role: m.role, content: m.content 
      })),
      { role: 'user', content: userMessage }
    ],
    max_tokens: 400,
    temperature: 0.7,
  });
  return response.choices[0].message.content;
};

exports.generateMealPlan = async ({ profile }) => {
  const w = profile.weight_kg;
  const h = profile.height_cm;
  const a = profile.age;
  const isFemale = profile.gender === 'female';
  const bmr = isFemale
    ? (10*w) + (6.25*h) - (5*a) - 161
    : (10*w) + (6.25*h) - (5*a) + 5;
  const target = profile.primary_goal === 'lose_fat'
    ? Math.round(bmr * 1.55) - 400
    : Math.round(bmr * 1.55) + 200;

  const response = await groq.chat.completions.create({
    model: 'llama3-8b-8192',
    messages: [{
      role: 'user',
      content: `Create meal plan. Goal: ${profile.primary_goal}. 
Calories: ${target}. Return ONLY this JSON format, nothing else:
{"daily_calories":${target},"daily_protein_g":150,
"daily_carbs_g":180,"daily_fat_g":55,"meals":[
{"meal_type":"breakfast","name":"Oats with banana",
"description":"Healthy and filling","calories":400,
"protein_g":15,"carbs_g":70,"fat_g":8},
{"meal_type":"lunch","name":"Chicken rice bowl",
"description":"High protein meal","calories":550,
"protein_g":45,"carbs_g":60,"fat_g":12},
{"meal_type":"dinner","name":"Salmon and vegetables",
"description":"Omega 3 rich meal","calories":500,
"protein_g":40,"carbs_g":30,"fat_g":22},
{"meal_type":"snack","name":"Greek yogurt",
"description":"High protein snack","calories":150,
"protein_g":15,"carbs_g":12,"fat_g":3}]}`
    }],
    max_tokens: 1000,
    temperature: 0.3,
  });
  const text = response.choices[0].message.content;
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
};

exports.generateWorkoutWithAI = async ({ 
  profile, dayFocus 
}) => {
  const response = await groq.chat.completions.create({
    model: 'llama3-8b-8192',
    messages: [{
      role: 'user',
      content: `Create ${dayFocus} workout for 
${profile.fitness_level} level, goal: ${profile.primary_goal}.
Return ONLY JSON:
{"exercises":[{"name":"Hip Thrust","sets":4,"reps":"12",
"rest_seconds":60,"coaching_tip":"Squeeze at top"}],
"estimated_duration_min":45,
"warmup":["5 min walk","Hip circles"],
"cooldown":["Hip stretch","Hamstring stretch"]}`
    }],
    max_tokens: 600,
    temperature: 0.5,
  });
  const text = response.choices[0].message.content;
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
};

exports.analyzeBodyScan = async ({ profile }) => {
  const response = await groq.chat.completions.create({
    model: 'llama3-8b-8192',
    messages: [{
      role: 'user',
      content: `Estimate body composition for:
Gender: ${profile.gender}, Age: ${profile.age}
Weight: ${profile.weight_kg}kg, Height: ${profile.height_cm}cm
Level: ${profile.fitness_level}
Return ONLY JSON:
{"body_fat_estimate_pct":22,"muscle_distribution":
"Even distribution","posture_notes":"Good posture overall",
"symmetry_score":8,"strengths":["Good endurance"],
"areas_to_improve":["Core strength"],
"recommendations":["Add planks daily"]}`
    }],
    max_tokens: 400,
    temperature: 0.5,
  });
  const text = response.choices[0].message.content;
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
};
```
