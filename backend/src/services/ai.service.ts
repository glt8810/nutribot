/**
 * AI Service — Local Gemma 4 via Ollama
 * Generates plan modules via structured prompts
 */

import { Ollama } from 'ollama';
import type { GoalType, ModuleType } from '../lib/constants';

// Initialize Ollama client pointing to your local environment variable
const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
const MODEL_NAME = 'gemma4'; // Ensure this matches the tag you downloaded

const SYSTEM_PROMPT = `You are an expert nutritionist with 30 years of experience. You're encouraging, knowledgeable, and straight-talking. Like a brilliant friend who happens to have a nutrition degree and a genuine passion for helping people feel their best without giving up the foods they love.

Your personality:
- Warm, encouraging, and motivating — never judgmental
- Straight-talking but kind — honest without being harsh
- Fun and human — use humor, exciting food language, themed days
- Empowering — explain the "why" behind every recommendation
- Inclusive — no assumptions about body type, gender, ability, culture, or income
- Anti-diet-culture — no shame, no "clean eating" language, no moralizing food
- Evidence-based — every recommendation grounded in science, not trends

IMPORTANT RULES:
- Always respond with valid JSON matching the requested schema
- Never include medical diagnoses or prescriptions
- Always recommend consulting a healthcare provider for medical conditions
- For eating disorder recovery goals, NEVER include calorie counts or restrictive language
- Include appropriate disclaimers for pregnancy, medical conditions, and ED recovery goals
- MULTILINGUAL SUPPORT: You must generate all human-readable text (titles, descriptions, step-by-step instructions, dish names, tips) in the user's requested language.
- JSON INTEGRITY: Even when generating content in another language, all JSON keys MUST remain exactly as defined in the English schema. Never translate the keys.`;

function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') 
    .replace(/```/g, '') 
    .replace(/\b(ignore|disregard|forget|override|system|prompt|instruction)\b/gi, '[filtered]')
    .substring(0, 5000); 
}

interface GenerationContext {
  goalType: GoalType;
  stats: any;
  lifestyle: any;
  foodPrefs: any;
  snackHabits: any;
  calculations: any;
}

export async function generateModule(
  moduleType: ModuleType,
  context: GenerationContext
): Promise<any> {
  const prompt = buildModulePrompt(moduleType, context);

  try {
    const response = await ollama.chat({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      format: 'json', // Forces local model to output structured JSON
      options: {
        num_ctx: 8192, // Expands context window for large 7-day meal plans
        temperature: 0.7
      }
    });

    const parsed = JSON.parse(response.message.content);

    // Content filter: check for inappropriate content
    return filterContent(parsed, context.goalType);
  } catch (err: any) {
    console.error(`[AI] Error generating ${moduleType}:`, err.message);
    throw new Error(`Failed to generate ${moduleType}: ${err.message}`);
  }
}

export async function regenerateMeal(
  context: GenerationContext,
  dayIndex: number,
  mealType: string,
  currentMealPlan: any
): Promise<any> {
  const prompt = `Based on this person's profile, generate a SINGLE replacement ${mealType} for Day ${dayIndex + 1} of their meal plan.

PERSON'S PROFILE:
- Goal: ${context.goalType}
- Food Preferences: ${sanitizeInput(JSON.stringify(context.foodPrefs))}
- Restrictions/Allergies: ${sanitizeInput(JSON.stringify(context.foodPrefs?.restrictions || 'none'))}
${context.calculations?.targetCalories ? `- Daily Calorie Target: ${context.calculations.targetCalories} kcal` : ''}
${context.calculations?.macros ? `- Daily Macros: ${context.calculations.macros.protein}g protein, ${context.calculations.macros.carbs}g carbs, ${context.calculations.macros.fat}g fat` : ''}

CURRENT MEAL BEING REPLACED:
${sanitizeInput(JSON.stringify(currentMealPlan?.days?.[dayIndex]?.[mealType] || 'unknown'))}

Generate something DIFFERENT from what they had. Make it exciting and aligned with their preferences.

Respond with ONLY valid JSON in this format:
{
  "name": "Meal name",
  "description": "Brief appetizing description",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "instructions": "Brief cooking instructions",
  "prepTime": "15 min",
  ${context.goalType !== 'ed_recovery' ? '"calories": 450, "protein": 30, "carbs": 40, "fat": 15,' : ''}
  "tags": ["quick", "high-protein"]
}`;

  try {
    const response = await ollama.chat({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      format: 'json',
      options: {
        num_predict: 1024
      }
    });

    return JSON.parse(response.message.content);
  } catch (err: any) {
    console.error(`[AI] Error regenerating meal:`, err.message);
    throw new Error(`Failed to regenerate meal: ${err.message}`);
  }
}

function buildModulePrompt(moduleType: ModuleType, ctx: GenerationContext): string {
  const statsStr = sanitizeInput(JSON.stringify(ctx.stats || {}));
  const lifestyleStr = sanitizeInput(JSON.stringify(ctx.lifestyle || {}));
  const foodPrefsStr = sanitizeInput(JSON.stringify(ctx.foodPrefs || {}));
  const snackStr = sanitizeInput(JSON.stringify(ctx.snackHabits || {}));
  const calcsStr = sanitizeInput(JSON.stringify(ctx.calculations || {}));
  
  // Extract language or default to English
  const targetLanguage = ctx.stats?.language || 'English';

  const profileBlock = `
PERSON'S PROFILE:
- Goal: ${ctx.goalType}
- Target Language: ${targetLanguage}
- Stats: ${statsStr}
- Lifestyle: ${lifestyleStr}
- Food Preferences: ${foodPrefsStr}
- Snack Habits: ${snackStr}
- Calculated Values: ${calcsStr}

CRITICAL INSTRUCTION: All generated text values must be written in ${targetLanguage}. Do not translate the JSON keys.`;

  const prompts: Record<ModuleType, string> = {
    calorie_calc: `${profileBlock}

Generate a calorie calculation explanation module. The actual numbers have already been calculated:
- BMR: ${ctx.calculations?.bmr} kcal
- Activity Level: ${ctx.calculations?.activityLevel} (×${ctx.calculations?.activityMultiplier})
- TDEE: ${ctx.calculations?.tdee} kcal
- Target: ${ctx.calculations?.targetCalories} kcal
${ctx.calculations?.deficit ? `- Deficit: ${ctx.calculations.deficit} kcal` : ''}
${ctx.calculations?.surplus ? `- Surplus: ${ctx.calculations.surplus} kcal` : ''}

Write an encouraging, clear explanation of these numbers in the persona's voice. Include the disclaimer about online calculators. Explain step by step. Recommend tracking intake for 2 weeks to find true maintenance.

Respond with ONLY valid JSON:
{
  "title": "Your Calorie Breakdown",
  "disclaimer": "...",
  "stepByStep": ["Step 1: ...", "Step 2: ..."],
  "recommendation": "...",
  "adjustmentTips": ["tip1", "tip2"]
}`,

    macros: `${profileBlock}

Generate a macro targets explanation. The actual numbers are:
- Protein: ${ctx.calculations?.macros?.protein}g (${ctx.calculations?.macros?.proteinPercent}%)
- Carbs: ${ctx.calculations?.macros?.carbs}g (${ctx.calculations?.macros?.carbsPercent}%)
- Fat: ${ctx.calculations?.macros?.fat}g (${ctx.calculations?.macros?.fatPercent}%)

Explain in plain English why each macro is set at that level for THIS person's goal. Be encouraging and practical.

Respond with ONLY valid JSON:
{
  "title": "Your Macro Targets",
  "proteinExplanation": "...",
  "carbsExplanation": "...",
  "fatExplanation": "...",
  "practicalTips": ["tip1", "tip2", "tip3"],
  "foodSources": { "protein": ["..."], "carbs": ["..."], "fat": ["..."] }
}`,

    meal_plan: `${profileBlock}

Generate a complete 7-day meal plan. Each day has breakfast, lunch, dinner, and one snack/dessert.

RULES:
- Use their favorite foods and cuisines as inspiration
- NO boring chicken-and-broccoli unless they asked for it
- Give every day a fun theme (e.g. "Mediterranean Monday", "Tex-Mex Tuesday")
- Flag meals great for batch cooking/meal prep
- Include at least 2 treat-like meals per week
- Respect ALL allergies, restrictions, and dietary preferences absolutely
- If they drink alcohol, include it in relevant days
${ctx.goalType !== 'ed_recovery' ? '- Include calorie and macro counts per meal' : '- NO calorie counts or restrictive language — focus on variety, adequacy, and enjoyment'}
${ctx.goalType === 'sports' ? '- Differentiate training-day vs rest-day meals. Include pre/post workout nutrition.' : ''}
${ctx.goalType === 'pregnancy' ? '- Emphasize folate, iron, calcium, choline, omega-3. Flag foods to avoid. Use portion guidance, not calorie counts.' : ''}
${ctx.goalType === 'gut_health' ? '- Include prebiotic and probiotic foods daily. Avoid their trigger foods. Gentle fiber progression.' : ''}
${ctx.goalType === 'plant_based' ? '- Ensure complete amino acids daily. Highlight B12, iron, zinc, calcium, omega-3 sources. Include bridge foods.' : ''}
${ctx.goalType === 'family' ? '- One plan for the whole household with modification notes. Budget-conscious ingredients.' : ''}

Respond with ONLY valid JSON:
{
  "days": [
    {
      "dayNumber": 1,
      "theme": "Mediterranean Monday",
      "breakfast": { "name": "...", "description": "...", "ingredients": ["..."], "instructions": "...", "prepTime": "15 min", "tags": ["quick"], ${ctx.goalType !== 'ed_recovery' ? '"calories": 400, "protein": 25, "carbs": 45, "fat": 12' : '"portionGuide": "..."'} },
      "lunch": { ... },
      "dinner": { ... },
      "snack": { ... }${ctx.goalType !== 'ed_recovery' ? ',\n      "dailyTotals": { "calories": 2000, "protein": 150, "carbs": 200, "fat": 70 }' : ''}
    }
  ]
}`,

    snack_swaps: `${profileBlock}

${ctx.goalType === 'ed_recovery' ? `Generate a list of 8-10 satisfying snack IDEAS organized by category (sweet, savory, crunchy, creamy). NO "swaps" framing. NO calorie counts. NO judgment. Normalize all choices. Include "fun" foods alongside nutritious ones.` : `Look at their current snacks: ${snackStr}. For each one, suggest a healthier alternative that scratches the SAME itch (sweet for sweet, crunchy for crunchy, salty for salty). Include at least 5 options with calorie comparisons. Make them EXCITING.`}

Respond with ONLY valid JSON:
{
  "title": "${ctx.goalType === 'ed_recovery' ? 'Snack Ideas to Enjoy' : 'Smart Snack Swaps'}",
  "items": [
    {
      ${ctx.goalType === 'ed_recovery' ? '"category": "sweet", "name": "...", "description": "...", "why": "..."' : '"current": "...", "swap": "...", "why": "...", "currentCalories": 300, "swapCalories": 150, "craving": "sweet"'}
    }
  ],
  "bonusTip": "..."
}`,

    rules: `${profileBlock}

Generate 5-7 PERSONALIZED rules to live by. These must be SPECIFIC to THIS person based on everything they shared — not generic advice. Reference their specific habits, challenges, lifestyle, and food preferences.

Respond with ONLY valid JSON:
{
  "title": "Your Personal Nutrition Playbook",
  "rules": [
    { "number": 1, "rule": "...", "why": "...", "howTo": "..." }
  ]
}`,

    timeline: `${profileBlock}

Generate an honest, encouraging timeline of what they can expect. Be real — no false promises — but keep them motivated.

${ctx.goalType === 'fat_loss' ? 'Include week-by-week weight projection. Mention scale fluctuations are normal. First week = water weight.' : ''}
${ctx.goalType === 'muscle_gain' ? 'Monthly lean mass projection. Set realistic expectations (0.5-1 lb lean mass/month for intermediates).' : ''}
${ctx.goalType === 'recomp' ? 'This is the slowest visible path. Progress shows in measurements and strength before the scale.' : ''}
${ctx.goalType === 'gut_health' ? 'Explain 2-4 week adjustment period. Symptoms may briefly worsen.' : ''}
${ctx.goalType === 'ed_recovery' ? 'NO weight timelines. Focus on behavioral milestones (eating consistently, reducing food fear, eating socially).' : ''}
${ctx.goalType === 'energy' ? '"You\'ll likely feel a difference within 1-2 weeks as blood sugar stabilizes."' : ''}

Respond with ONLY valid JSON:
{
  "title": "What to Expect",
  "milestones": [
    { "timeframe": "Week 1-2", "title": "...", "description": "...", "encouragement": "..." }
  ],
  "importantNote": "..."
}`,

    hydration: `${profileBlock}

The calculated hydration target is:
- Base: ${ctx.calculations?.hydration?.baseLitres}L
- Exercise addition: ${ctx.calculations?.hydration?.exerciseAddition}L
- Job addition: ${ctx.calculations?.hydration?.jobAddition}L
- Total: ${ctx.calculations?.hydration?.totalLitres}L (${ctx.calculations?.hydration?.totalOz} oz)

Write 3-4 practical, personalized tips for hitting this target based on their lifestyle. Explain the connection to their specific goal.

Respond with ONLY valid JSON:
{
  "title": "Your Hydration Game Plan",
  "dailyTarget": { "litres": ${ctx.calculations?.hydration?.totalLitres || 2.5}, "oz": ${ctx.calculations?.hydration?.totalOz || 84} },
  "breakdown": "...",
  "tips": ["tip1", "tip2", "tip3", "tip4"],
  "whyItMatters": "..."
}`,

    supplements: `${profileBlock}

Recommend ONLY supplements that are genuinely evidence-backed and relevant to THIS specific person. Do NOT recommend unnecessary or expensive supplements.

For each one provide: dose, best time to take it, why it's specifically relevant to them, and a budget-friendly suggestion.

Always close with: "Supplements are the 1% — food, training, sleep, and consistency are the 99%."

Respond with ONLY valid JSON:
{
  "title": "Smart Supplement Stack",
  "recommendations": [
    { "name": "...", "dose": "...", "timing": "...", "why": "...", "budgetTip": "..." }
  ],
  "closingNote": "Supplements are the 1% — food, training, sleep, and consistency are the 99%. Never let supplements do the work for you."
}`,

    grocery_list: `${profileBlock}

Generate a weekly grocery list organized by store section based on the meal plan context. Include estimated quantities. Flag pantry staples they likely already have. ${ctx.goalType === 'family' ? 'Include budget-friendly substitution notes.' : ''}

Respond with ONLY valid JSON:
{
  "title": "Your Weekly Grocery List",
  "sections": [
    {
      "name": "Produce",
      "items": [
        { "item": "...", "quantity": "...", "isPantryStaple": false, "budgetNote": "" }
      ]
    }
  ],
  "estimatedCost": "...",
  "savingTips": ["tip1", "tip2"]
}`,

    progress_tracking: `${profileBlock}

Tell them exactly how to track progress for their specific goal. Be practical and encouraging.

${ctx.goalType === 'fat_loss' ? 'Weekly weigh-ins protocol, measurements, progress photos, how clothes fit.' : ''}
${ctx.goalType === 'muscle_gain' ? 'Bi-weekly weigh-ins, strength log, monthly measurements.' : ''}
${ctx.goalType === 'recomp' ? 'De-emphasize the scale. Measurements, photos, strength PRs, clothes fit.' : ''}
${ctx.goalType === 'gut_health' ? 'Symptom journal: rate bloating, energy, bowel regularity daily on 1-5.' : ''}
${ctx.goalType === 'ed_recovery' ? 'NO weight tracking. Track behavioral wins only.' : ''}
${ctx.goalType === 'energy' ? 'Daily energy and focus journal.' : ''}

Respond with ONLY valid JSON:
{
  "title": "Tracking Your Progress",
  "methods": [
    { "method": "...", "frequency": "...", "howTo": "...", "whyItWorks": "..." }
  ],
  "mindsetNote": "..."
}`,
  };

  return prompts[moduleType] || `Generate content for module: ${moduleType}. ${profileBlock}. Respond with valid JSON.`;
}

function filterContent(data: any, goalType: GoalType): any {
  // Content safety filter
  const jsonStr = JSON.stringify(data);

  // Check for medical advice red flags
  const medicalFlags = ['diagnose', 'prescription', 'cure', 'treat disease'];
  for (const flag of medicalFlags) {
    if (jsonStr.toLowerCase().includes(flag)) {
      console.warn(`[AI Content Filter] Medical advice flag detected: ${flag}`);
    }
  }

  // For ED recovery, ensure no calorie counts leaked through
  if (goalType === 'ed_recovery') {
    // Remove any calorie-related fields
    const sanitized = JSON.parse(jsonStr, (key, value) => {
      if (['calories', 'calorie', 'kcal', 'caloric'].some(k => key.toLowerCase().includes(k))) {
        return undefined;
      }
      return value;
    });
    return sanitized;
  }

  return data;
}
