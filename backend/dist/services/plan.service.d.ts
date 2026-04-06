/**
 * Plan Service — Orchestrates AI plan generation
 */
export declare function generatePlan(userId: string, goalId: string): Promise<{
    planId: string;
    modules: any[];
}>;
export declare function getPlan(userId: string, planId: string): Promise<{
    goal: {
        userId: string;
        id: string;
        goalType: string;
        selectedAt: Date;
    };
    modules: ({
        mealFeedback: {
            id: string;
            createdAt: Date;
            moduleId: string;
            dayIndex: number;
            mealType: string;
            feedback: string | null;
        }[];
    } & {
        id: string;
        planId: string;
        moduleType: string;
        moduleData: import("@prisma/client/runtime/library").JsonValue;
        generatedAt: Date;
        regeneratedCount: number;
    })[];
} & {
    id: string;
    createdAt: Date;
    expiresAt: Date | null;
    goalId: string;
    planVersion: number;
    generationParams: import("@prisma/client/runtime/library").JsonValue | null;
    isActive: boolean;
}>;
export declare function getActivePlan(userId: string): Promise<({
    goal: {
        userId: string;
        id: string;
        goalType: string;
        selectedAt: Date;
    };
    modules: ({
        mealFeedback: {
            id: string;
            createdAt: Date;
            moduleId: string;
            dayIndex: number;
            mealType: string;
            feedback: string | null;
        }[];
    } & {
        id: string;
        planId: string;
        moduleType: string;
        moduleData: import("@prisma/client/runtime/library").JsonValue;
        generatedAt: Date;
        regeneratedCount: number;
    })[];
} & {
    id: string;
    createdAt: Date;
    expiresAt: Date | null;
    goalId: string;
    planVersion: number;
    generationParams: import("@prisma/client/runtime/library").JsonValue | null;
    isActive: boolean;
}) | null>;
export declare function getUserPlans(userId: string): Promise<({
    goal: {
        goalType: string;
    };
} & {
    id: string;
    createdAt: Date;
    expiresAt: Date | null;
    goalId: string;
    planVersion: number;
    generationParams: import("@prisma/client/runtime/library").JsonValue | null;
    isActive: boolean;
})[]>;
export declare function regenerateModule(userId: string, planId: string, moduleId: string): Promise<any>;
export declare function regenerateSingleMeal(userId: string, planId: string, moduleId: string, dayIndex: number, mealType: string): Promise<any>;
export declare function addMealFeedback(userId: string, moduleId: string, dayIndex: number, mealType: string, feedback: string): Promise<void>;
//# sourceMappingURL=plan.service.d.ts.map