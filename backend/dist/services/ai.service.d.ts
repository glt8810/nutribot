/**
 * AI Service — Claude API Integration
 * Generates plan modules via structured prompts
 */
import type { GoalType, ModuleType } from '../lib/constants';
interface GenerationContext {
    goalType: GoalType;
    stats: any;
    lifestyle: any;
    foodPrefs: any;
    snackHabits: any;
    calculations: any;
}
export declare function generateModule(moduleType: ModuleType, context: GenerationContext): Promise<any>;
export declare function regenerateMeal(context: GenerationContext, dayIndex: number, mealType: string, currentMealPlan: any): Promise<any>;
export {};
//# sourceMappingURL=ai.service.d.ts.map