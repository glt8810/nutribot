/**
 * Programmatic Nutrition Calculations
 * BMR, TDEE, Calorie Targets, Macro Targets, Hydration
 */

export interface StatsInput {
  age: number;
  biologicalSex: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  goalWeightKg?: number;
  jobType: string;
  exerciseFrequency: string;
  exerciseType?: string;
  hoursExercisePerWeek?: number;
}

export interface CalorieResult {
  bmr: number;
  activityMultiplier: number;
  activityLevel: string;
  tdee: number;
  targetCalories: number;
  deficit?: number;
  surplus?: number;
  explanation: string;
}

export interface MacroResult {
  protein: number;
  carbs: number;
  fat: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
  explanation: string;
}

export interface HydrationResult {
  baseLitres: number;
  exerciseAddition: number;
  jobAddition: number;
  specialAddition: number;
  totalLitres: number;
  totalOz: number;
}

/**
 * Calculate BMR using Mifflin-St Jeor
 */
export function calculateBMR(sex: 'male' | 'female', weightKg: number, heightCm: number, age: number): number {
  if (sex === 'male') {
    return Math.round((10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5);
  } else {
    return Math.round((10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161);
  }
}

/**
 * Determine activity multiplier from job type and exercise frequency
 */
export function getActivityMultiplier(jobType: string, exerciseFrequency: string): { multiplier: number; level: string } {
  const isPhysicalJob = ['manual_labour', 'physical', 'on_feet', 'active'].some(k =>
    jobType.toLowerCase().includes(k)
  );
  const isHeavyJob = jobType.toLowerCase().includes('heavy') || jobType.toLowerCase().includes('manual_labour');

  let workoutsPerWeek = 0;
  if (exerciseFrequency.includes('1') || exerciseFrequency.includes('2') || exerciseFrequency.includes('3')) {
    workoutsPerWeek = 2;
  }
  if (exerciseFrequency.includes('3') || exerciseFrequency.includes('4') || exerciseFrequency.includes('5')) {
    workoutsPerWeek = 4;
  }
  if (exerciseFrequency.includes('6') || exerciseFrequency.includes('7') || exerciseFrequency.toLowerCase().includes('daily')) {
    workoutsPerWeek = 6;
  }
  if (exerciseFrequency.toLowerCase().includes('none') || exerciseFrequency.toLowerCase().includes("don't")) {
    workoutsPerWeek = 0;
  }

  if (isHeavyJob && workoutsPerWeek >= 5) {
    return { multiplier: 1.9, level: 'Extremely active' };
  }
  if (isPhysicalJob && workoutsPerWeek >= 4) {
    return { multiplier: 1.725, level: 'Very active' };
  }
  if ((isPhysicalJob && workoutsPerWeek < 4) || (!isPhysicalJob && workoutsPerWeek >= 4)) {
    return { multiplier: 1.55, level: 'Moderately active' };
  }
  if (!isPhysicalJob && workoutsPerWeek >= 1) {
    return { multiplier: 1.375, level: 'Lightly active' };
  }
  return { multiplier: 1.2, level: 'Sedentary' };
}

/**
 * Calculate full calorie target
 */
export function calculateCalories(stats: StatsInput, goalType: string, trimester?: string, breastfeeding?: boolean): CalorieResult {
  const bmr = calculateBMR(stats.biologicalSex, stats.weightKg, stats.heightCm, stats.age);
  const { multiplier, level } = getActivityMultiplier(stats.jobType, stats.exerciseFrequency);
  const tdee = Math.round(bmr * multiplier);

  let targetCalories = tdee;
  let deficit: number | undefined;
  let surplus: number | undefined;
  let explanation = '';

  switch (goalType) {
    case 'fat_loss':
      deficit = 500;
      targetCalories = tdee - deficit;
      const minCals = stats.biologicalSex === 'female' ? 1200 : 1500;
      if (targetCalories < minCals) {
        targetCalories = minCals;
        deficit = tdee - targetCalories;
      }
      explanation = `A ${deficit} kcal deficit for steady fat loss (~1 lb/week). Floor set at ${minCals} kcal for safety.`;
      break;

    case 'muscle_gain':
      surplus = 350;
      targetCalories = tdee + surplus;
      explanation = `A ${surplus} kcal surplus to fuel muscle growth without excessive fat gain.`;
      break;

    case 'recomp':
      deficit = 150;
      targetCalories = tdee - deficit;
      explanation = 'Eating slightly below maintenance to encourage body recomposition. Protein is the priority here.';
      break;

    case 'sports':
      // Training day vs rest day
      targetCalories = tdee;
      explanation = 'Eating at maintenance on average. On heavy training days add 200-400 kcal, on rest days subtract 100-200 kcal.';
      break;

    case 'pregnancy':
      if (trimester === '1st') {
        targetCalories = tdee;
        explanation = 'First trimester: no extra calories needed. Focus on nutrient density.';
      } else if (trimester === '2nd') {
        targetCalories = tdee + 340;
        explanation = 'Second trimester: +340 kcal to support growing baby.';
      } else if (trimester === '3rd') {
        targetCalories = tdee + 450;
        explanation = 'Third trimester: +450 kcal to support rapid baby growth.';
      } else if (breastfeeding) {
        targetCalories = tdee + 500;
        explanation = 'Breastfeeding: +500 kcal to support milk production.';
      } else {
        targetCalories = tdee;
        explanation = 'Postpartum recovery: eat at maintenance, focus on nutrient-dense foods.';
      }
      break;

    case 'family':
      targetCalories = tdee;
      explanation = 'Eating at maintenance for balanced family nutrition.';
      break;

    default:
      targetCalories = tdee;
      explanation = 'No strict calorie target — using portion-based guidance is more appropriate for this goal.';
  }

  return {
    bmr,
    activityMultiplier: multiplier,
    activityLevel: level,
    tdee,
    targetCalories,
    deficit,
    surplus,
    explanation,
  };
}

/**
 * Calculate macro targets in grams
 */
export function calculateMacros(targetCalories: number, weightKg: number, goalType: string): MacroResult {
  const weightLbs = weightKg * 2.205;
  let proteinGrams: number;
  let fatPercent: number;
  let explanation: string;

  switch (goalType) {
    case 'fat_loss':
      proteinGrams = Math.round(weightLbs * 1.1); // 1.0-1.2g per lb
      fatPercent = 0.27;
      explanation = 'High protein to preserve muscle during fat loss. Moderate fat. Remaining calories from carbs.';
      break;

    case 'muscle_gain':
      proteinGrams = Math.round(weightLbs * 1.1);
      fatPercent = 0.25;
      explanation = 'High protein for muscle synthesis, higher carbs to fuel training, moderate fat.';
      break;

    case 'recomp':
      proteinGrams = Math.round(weightLbs * 1.3); // Highest protein
      fatPercent = 0.28;
      explanation = 'Highest protein priority for recomp. This is the most important macro for your goal.';
      break;

    case 'sports':
      proteinGrams = Math.round(weightLbs * 1.0);
      fatPercent = 0.25;
      explanation = 'Balanced macros for performance. Adjust carbs higher on heavy training days.';
      break;

    default:
      proteinGrams = Math.round(weightLbs * 0.8);
      fatPercent = 0.30;
      explanation = 'Balanced macro distribution for general wellbeing.';
  }

  const proteinCalories = proteinGrams * 4;
  const fatCalories = Math.round(targetCalories * fatPercent);
  const fatGrams = Math.round(fatCalories / 9);
  const carbCalories = targetCalories - proteinCalories - fatCalories;
  const carbGrams = Math.round(carbCalories / 4);

  return {
    protein: proteinGrams,
    carbs: Math.max(carbGrams, 50), // Minimum 50g carbs
    fat: fatGrams,
    proteinPercent: Math.round((proteinCalories / targetCalories) * 100),
    carbsPercent: Math.round(((Math.max(carbGrams, 50) * 4) / targetCalories) * 100),
    fatPercent: Math.round(fatPercent * 100),
    explanation,
  };
}

/**
 * Calculate hydration target
 */
export function calculateHydration(
  weightKg: number,
  hoursExercisePerWeek: number = 0,
  isPhysicalJob: boolean = false,
  isPregnantOrBreastfeeding: boolean = false
): HydrationResult {
  const baseLitres = parseFloat(((weightKg * 35) / 1000).toFixed(1));
  const exerciseHoursPerDay = hoursExercisePerWeek / 7;
  const exerciseAddition = parseFloat((exerciseHoursPerDay * 0.5).toFixed(1));
  const jobAddition = isPhysicalJob ? 0.75 : 0;
  const specialAddition = isPregnantOrBreastfeeding ? 0.5 : 0;

  const totalLitres = parseFloat((baseLitres + exerciseAddition + jobAddition + specialAddition).toFixed(1));
  const totalOz = Math.round(totalLitres * 33.814);

  return {
    baseLitres,
    exerciseAddition,
    jobAddition,
    specialAddition,
    totalLitres,
    totalOz,
  };
}
