"use strict";
/**
 * Plan Service — Orchestrates AI plan generation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePlan = generatePlan;
exports.getPlan = getPlan;
exports.getActivePlan = getActivePlan;
exports.getUserPlans = getUserPlans;
exports.regenerateModule = regenerateModule;
exports.regenerateSingleMeal = regenerateSingleMeal;
exports.addMealFeedback = addMealFeedback;
const prisma_1 = __importDefault(require("../lib/prisma"));
const crypto_service_1 = require("./crypto.service");
const calculations_1 = require("./calculations");
const ai_service_1 = require("./ai.service");
const constants_1 = require("../lib/constants");
async function getIntakeData(goalId) {
    const responses = await prisma_1.default.intakeResponse.findMany({
        where: { goalId },
    });
    const data = {};
    for (const r of responses) {
        data[r.section] = (0, crypto_service_1.decryptJSON)(r.responsesEnc);
    }
    return data;
}
function buildCalculations(stats, lifestyle, goalType) {
    const age = stats?.age || 30;
    const sex = stats?.biologicalSex || 'male';
    const heightCm = stats?.heightCm || 170;
    const weightKg = stats?.weightKg || 75;
    const jobType = lifestyle?.jobType || 'desk';
    const exerciseFrequency = lifestyle?.exerciseFrequency || 'none';
    const hoursExercisePerWeek = lifestyle?.hoursExercisePerWeek || 0;
    const isPhysicalJob = ['manual_labour', 'physical', 'on_feet', 'active'].some(k => (jobType || '').toLowerCase().includes(k));
    const calorieCalc = (0, calculations_1.calculateCalories)({ age, biologicalSex: sex, heightCm, weightKg, jobType, exerciseFrequency }, goalType, stats?.trimester, stats?.breastfeeding);
    const macroCalc = ['fat_loss', 'muscle_gain', 'recomp', 'sports'].includes(goalType)
        ? (0, calculations_1.calculateMacros)(calorieCalc.targetCalories, weightKg, goalType)
        : null;
    const hydrationCalc = (0, calculations_1.calculateHydration)(weightKg, hoursExercisePerWeek, isPhysicalJob, goalType === 'pregnancy');
    return {
        ...calorieCalc,
        macros: macroCalc,
        hydration: hydrationCalc,
    };
}
async function generatePlan(userId, goalId) {
    // Verify ownership
    const goal = await prisma_1.default.goal.findFirst({
        where: { id: goalId, userId },
    });
    if (!goal)
        throw new Error('GOAL_NOT_FOUND');
    // Get intake data
    const intakeData = await getIntakeData(goalId);
    if (!intakeData.my_stats || !intakeData.my_lifestyle || !intakeData.my_food_prefs || !intakeData.my_snack_habits) {
        throw new Error('INTAKE_INCOMPLETE');
    }
    // Run calculations
    const calculations = buildCalculations(intakeData.my_stats, intakeData.my_lifestyle, goal.goalType);
    // Deactivate previous plans
    await prisma_1.default.nutritionPlan.updateMany({
        where: { goalId, isActive: true },
        data: { isActive: false },
    });
    // Create plan record
    const plan = await prisma_1.default.nutritionPlan.create({
        data: {
            goalId,
            generationParams: {
                stats: intakeData.my_stats,
                lifestyle: intakeData.my_lifestyle,
                foodPrefs: intakeData.my_food_prefs,
                snackHabits: intakeData.my_snack_habits,
                calculations,
            },
            expiresAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 4 weeks
        },
    });
    // Determine which modules to generate
    const modulesToGenerate = constants_1.GOAL_MODULES[goal.goalType] || [];
    const context = {
        goalType: goal.goalType,
        stats: intakeData.my_stats,
        lifestyle: intakeData.my_lifestyle,
        foodPrefs: intakeData.my_food_prefs,
        snackHabits: intakeData.my_snack_habits,
        calculations,
    };
    // Generate modules sequentially (to manage API rate limits)
    const generatedModules = [];
    for (const moduleType of modulesToGenerate) {
        try {
            const moduleData = await (0, ai_service_1.generateModule)(moduleType, context);
            const module = await prisma_1.default.planModule.create({
                data: {
                    planId: plan.id,
                    moduleType,
                    moduleData,
                },
            });
            generatedModules.push({
                id: module.id,
                moduleType,
                status: 'completed',
            });
        }
        catch (err) {
            console.error(`[Plan] Failed to generate module ${moduleType}:`, err.message);
            // Store error state
            const module = await prisma_1.default.planModule.create({
                data: {
                    planId: plan.id,
                    moduleType,
                    moduleData: { error: true, message: err.message },
                },
            });
            generatedModules.push({
                id: module.id,
                moduleType,
                status: 'error',
                error: err.message,
            });
        }
    }
    // Audit log
    await prisma_1.default.auditLog.create({
        data: {
            userId,
            eventType: constants_1.AUDIT_EVENTS.PLAN_GENERATED,
            metadata: {
                planId: plan.id,
                goalType: goal.goalType,
                modulesGenerated: generatedModules.length,
                modulesSuccessful: generatedModules.filter(m => m.status === 'completed').length,
            },
        },
    });
    return {
        planId: plan.id,
        modules: generatedModules,
    };
}
async function getPlan(userId, planId) {
    const plan = await prisma_1.default.nutritionPlan.findFirst({
        where: { id: planId, goal: { userId } },
        include: {
            goal: true,
            modules: {
                include: {
                    mealFeedback: true,
                },
                orderBy: { generatedAt: 'asc' },
            },
        },
    });
    if (!plan)
        throw new Error('PLAN_NOT_FOUND');
    return plan;
}
async function getActivePlan(userId) {
    const plan = await prisma_1.default.nutritionPlan.findFirst({
        where: {
            goal: { userId },
            isActive: true,
        },
        include: {
            goal: true,
            modules: {
                include: {
                    mealFeedback: true,
                },
                orderBy: { generatedAt: 'asc' },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    return plan;
}
async function getUserPlans(userId) {
    const plans = await prisma_1.default.nutritionPlan.findMany({
        where: { goal: { userId } },
        include: {
            goal: {
                select: { goalType: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    return plans;
}
async function regenerateModule(userId, planId, moduleId) {
    const module = await prisma_1.default.planModule.findFirst({
        where: {
            id: moduleId,
            planId,
            plan: { goal: { userId } },
        },
        include: {
            plan: {
                include: { goal: true },
            },
        },
    });
    if (!module)
        throw new Error('MODULE_NOT_FOUND');
    const params = module.plan.generationParams;
    const calculations = buildCalculations(params.stats, params.lifestyle, module.plan.goal.goalType);
    const context = {
        goalType: module.plan.goal.goalType,
        stats: params.stats,
        lifestyle: params.lifestyle,
        foodPrefs: params.foodPrefs,
        snackHabits: params.snackHabits,
        calculations,
    };
    const newData = await (0, ai_service_1.generateModule)(module.moduleType, context);
    await prisma_1.default.planModule.update({
        where: { id: moduleId },
        data: {
            moduleData: newData,
            regeneratedCount: { increment: 1 },
            generatedAt: new Date(),
        },
    });
    await prisma_1.default.auditLog.create({
        data: {
            userId,
            eventType: constants_1.AUDIT_EVENTS.MODULE_REGENERATED,
            metadata: { planId, moduleId, moduleType: module.moduleType },
        },
    });
    return newData;
}
async function regenerateSingleMeal(userId, planId, moduleId, dayIndex, mealType) {
    const module = await prisma_1.default.planModule.findFirst({
        where: {
            id: moduleId,
            planId,
            moduleType: 'meal_plan',
            plan: { goal: { userId } },
        },
        include: {
            plan: {
                include: { goal: true },
            },
        },
    });
    if (!module)
        throw new Error('MODULE_NOT_FOUND');
    const params = module.plan.generationParams;
    const calculations = buildCalculations(params.stats, params.lifestyle, module.plan.goal.goalType);
    const context = {
        goalType: module.plan.goal.goalType,
        stats: params.stats,
        lifestyle: params.lifestyle,
        foodPrefs: params.foodPrefs,
        snackHabits: params.snackHabits,
        calculations,
    };
    const newMeal = await (0, ai_service_1.regenerateMeal)(context, dayIndex, mealType, module.moduleData);
    // Update the meal in the plan
    const currentData = module.moduleData;
    if (currentData.days && currentData.days[dayIndex]) {
        currentData.days[dayIndex][mealType] = newMeal;
    }
    await prisma_1.default.planModule.update({
        where: { id: moduleId },
        data: {
            moduleData: currentData,
            regeneratedCount: { increment: 1 },
        },
    });
    // Record feedback
    await prisma_1.default.mealFeedback.create({
        data: {
            moduleId,
            dayIndex,
            mealType,
            feedback: 'regenerated',
        },
    });
    return newMeal;
}
async function addMealFeedback(userId, moduleId, dayIndex, mealType, feedback) {
    // Verify ownership
    const module = await prisma_1.default.planModule.findFirst({
        where: {
            id: moduleId,
            plan: { goal: { userId } },
        },
    });
    if (!module)
        throw new Error('MODULE_NOT_FOUND');
    await prisma_1.default.mealFeedback.create({
        data: {
            moduleId,
            dayIndex,
            mealType,
            feedback,
        },
    });
}
//# sourceMappingURL=plan.service.js.map