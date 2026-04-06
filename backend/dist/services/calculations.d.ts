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
export declare function calculateBMR(sex: 'male' | 'female', weightKg: number, heightCm: number, age: number): number;
/**
 * Determine activity multiplier from job type and exercise frequency
 */
export declare function getActivityMultiplier(jobType: string, exerciseFrequency: string): {
    multiplier: number;
    level: string;
};
/**
 * Calculate full calorie target
 */
export declare function calculateCalories(stats: StatsInput, goalType: string, trimester?: string, breastfeeding?: boolean): CalorieResult;
/**
 * Calculate macro targets in grams
 */
export declare function calculateMacros(targetCalories: number, weightKg: number, goalType: string): MacroResult;
/**
 * Calculate hydration target
 */
export declare function calculateHydration(weightKg: number, hoursExercisePerWeek?: number, isPhysicalJob?: boolean, isPregnantOrBreastfeeding?: boolean): HydrationResult;
//# sourceMappingURL=calculations.d.ts.map