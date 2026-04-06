import { z } from 'zod';
export declare const createGoalSchema: z.ZodObject<{
    goalType: z.ZodEnum<z.Writeable<any>>;
}, "strip", z.ZodTypeAny, {
    goalType?: any;
}, {
    goalType?: any;
}>;
export declare const saveIntakeSchema: z.ZodObject<{
    section: z.ZodEnum<z.Writeable<any>>;
    responses: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    responses: Record<string, any>;
    section?: any;
}, {
    responses: Record<string, any>;
    section?: any;
}>;
export declare const goalIdParamSchema: z.ZodObject<{
    goalId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    goalId: string;
}, {
    goalId: string;
}>;
export declare const planIdParamSchema: z.ZodObject<{
    planId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    planId: string;
}, {
    planId: string;
}>;
export declare const moduleIdParamSchema: z.ZodObject<{
    moduleId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    moduleId: string;
}, {
    moduleId: string;
}>;
export declare const regenerateMealSchema: z.ZodObject<{
    dayIndex: z.ZodNumber;
    mealType: z.ZodEnum<["breakfast", "lunch", "dinner", "snack"]>;
}, "strip", z.ZodTypeAny, {
    dayIndex: number;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
}, {
    dayIndex: number;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
}>;
export declare const mealFeedbackSchema: z.ZodObject<{
    dayIndex: z.ZodNumber;
    mealType: z.ZodEnum<["breakfast", "lunch", "dinner", "snack"]>;
    feedback: z.ZodEnum<["liked", "disliked", "regenerated"]>;
}, "strip", z.ZodTypeAny, {
    dayIndex: number;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    feedback: "liked" | "disliked" | "regenerated";
}, {
    dayIndex: number;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    feedback: "liked" | "disliked" | "regenerated";
}>;
//# sourceMappingURL=intake.d.ts.map