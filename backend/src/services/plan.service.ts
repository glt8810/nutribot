/**
 * Plan Service — Orchestrates AI plan generation
 */

import prisma from '../lib/prisma';
import { encrypt, decrypt, encryptJSON, decryptJSON } from './crypto.service';
import { calculateCalories, calculateMacros, calculateHydration } from './calculations';
import { generateModule, regenerateMeal } from './ai.service';
import { GOAL_MODULES, AUDIT_EVENTS } from '../lib/constants';
import type { GoalType, ModuleType } from '../lib/constants';

interface IntakeData {
  my_stats: any;
  my_lifestyle: any;
  my_food_prefs: any;
  my_snack_habits: any;
}

async function getIntakeData(profileId: string): Promise<IntakeData> {
  const responses = await prisma.intakeResponse.findMany({
    where: { profileId },
  });

  const data: any = {};
  for (const r of responses) {
    data[r.section] = decryptJSON(r.responsesEnc);
  }

  return data as IntakeData;
}

function buildCalculations(stats: any, lifestyle: any, goalType: GoalType) {
  const age = stats?.age || 30;
  const sex = stats?.biologicalSex || 'male';
  const heightCm = stats?.heightCm || 170;
  const weightKg = stats?.weightKg || 75;
  const jobType = lifestyle?.jobType || 'desk';
  const exerciseFrequency = lifestyle?.exerciseFrequency || 'none';
  const hoursExercisePerWeek = lifestyle?.hoursExercisePerWeek || 0;
  const isPhysicalJob = ['manual_labour', 'physical', 'on_feet', 'active'].some(k =>
    (jobType || '').toLowerCase().includes(k)
  );

  const calorieCalc = calculateCalories(
    { age, biologicalSex: sex, heightCm, weightKg, jobType, exerciseFrequency },
    goalType,
    stats?.trimester,
    stats?.breastfeeding
  );

  const macroCalc = ['fat_loss', 'muscle_gain', 'recomp', 'sports'].includes(goalType)
    ? calculateMacros(calorieCalc.targetCalories, weightKg, goalType)
    : null;

  const hydrationCalc = calculateHydration(
    weightKg,
    hoursExercisePerWeek,
    isPhysicalJob,
    goalType === 'pregnancy'
  );

  return {
    ...calorieCalc,
    macros: macroCalc,
    hydration: hydrationCalc,
  };
}

export async function generatePlan(userId: string, goalId: string) {
  // Verify ownership
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
  });

  if (!goal) throw new Error('GOAL_NOT_FOUND');

  // Get intake data using the profile associated with the goal
  const intakeData = await getIntakeData(goal.profileId);

  if (!intakeData.my_stats || !intakeData.my_lifestyle || !intakeData.my_food_prefs || !intakeData.my_snack_habits) {
    throw new Error('INTAKE_INCOMPLETE');
  }

  // Run calculations
  const calculations = buildCalculations(intakeData.my_stats, intakeData.my_lifestyle, goal.goalType as GoalType);

  // Deactivate previous plans
  await prisma.nutritionPlan.updateMany({
    where: { goalId, isActive: true },
    data: { isActive: false },
  });

  // Create plan record
  const plan = await prisma.nutritionPlan.create({
    data: {
      goalId,
      generationParams: {
        stats: intakeData.my_stats,
        lifestyle: intakeData.my_lifestyle,
        foodPrefs: intakeData.my_food_prefs,
        snackHabits: intakeData.my_snack_habits,
        calculations: calculations as any,
      },
      expiresAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 4 weeks
    },
  });

  // Determine which modules to generate
  const modulesToGenerate = GOAL_MODULES[goal.goalType as GoalType] || [];

  const extras = goal.extrasEnc ? decryptJSON(goal.extrasEnc) : {};

  const context = {
    goalType: goal.goalType as GoalType,
    stats: intakeData.my_stats,
    lifestyle: intakeData.my_lifestyle,
    foodPrefs: intakeData.my_food_prefs,
    snackHabits: intakeData.my_snack_habits,
    extras,
    calculations,
  };

  // Generate modules sequentially (to manage API rate limits)
  const generatedModules: any[] = [];

  for (const moduleType of modulesToGenerate) {
    try {
      const moduleData = await generateModule(moduleType, context);

      const module = await prisma.planModule.create({
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
    } catch (err: any) {
      console.error(`[Plan] Failed to generate module ${moduleType}:`, err.message);

      // Store error state
      const module = await prisma.planModule.create({
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
  await prisma.auditLog.create({
    data: {
      userId,
      eventType: AUDIT_EVENTS.PLAN_GENERATED,
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

export async function getPlan(userId: string, planId: string) {
  const plan = await prisma.nutritionPlan.findFirst({
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

  if (!plan) throw new Error('PLAN_NOT_FOUND');

  return plan;
}

export async function getActivePlan(userId: string) {
  const plan = await prisma.nutritionPlan.findFirst({
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

export async function getUserPlans(userId: string) {
  const plans = await prisma.nutritionPlan.findMany({
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

export async function regenerateModule(userId: string, planId: string, moduleId: string) {
  const module = await prisma.planModule.findFirst({
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

  if (!module) throw new Error('MODULE_NOT_FOUND');

  const params = module.plan.generationParams as any;
  const calculations = buildCalculations(params.stats, params.lifestyle, module.plan.goal.goalType as GoalType);

  const context = {
    goalType: module.plan.goal.goalType as GoalType,
    stats: params.stats,
    lifestyle: params.lifestyle,
    foodPrefs: params.foodPrefs,
    snackHabits: params.snackHabits,
    calculations,
  };

  const newData = await generateModule(module.moduleType as ModuleType, context);

  await prisma.planModule.update({
    where: { id: moduleId },
    data: {
      moduleData: newData,
      regeneratedCount: { increment: 1 },
      generatedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      eventType: AUDIT_EVENTS.MODULE_REGENERATED,
      metadata: { planId, moduleId, moduleType: module.moduleType },
    },
  });

  return newData;
}

export async function regenerateSingleMeal(
  userId: string,
  planId: string,
  moduleId: string,
  dayIndex: number,
  mealType: string
) {
  const module = await prisma.planModule.findFirst({
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

  if (!module) throw new Error('MODULE_NOT_FOUND');

  const params = module.plan.generationParams as any;
  const calculations = buildCalculations(params.stats, params.lifestyle, module.plan.goal.goalType as GoalType);

  const context = {
    goalType: module.plan.goal.goalType as GoalType,
    stats: params.stats,
    lifestyle: params.lifestyle,
    foodPrefs: params.foodPrefs,
    snackHabits: params.snackHabits,
    calculations,
  };

  const newMeal = await regenerateMeal(context, dayIndex, mealType, module.moduleData);

  // Update the meal in the plan
  const currentData = module.moduleData as any;
  if (currentData.days && currentData.days[dayIndex]) {
    currentData.days[dayIndex][mealType] = newMeal;
  }

  await prisma.planModule.update({
    where: { id: moduleId },
    data: {
      moduleData: currentData,
      regeneratedCount: { increment: 1 },
    },
  });

  // Record feedback
  await prisma.mealFeedback.create({
    data: {
      moduleId,
      dayIndex,
      mealType,
      feedback: 'regenerated',
    },
  });

  return newMeal;
}

export async function addMealFeedback(
  userId: string,
  moduleId: string,
  dayIndex: number,
  mealType: string,
  feedback: string
) {
  // Verify ownership
  const module = await prisma.planModule.findFirst({
    where: {
      id: moduleId,
      plan: { goal: { userId } },
    },
  });

  if (!module) throw new Error('MODULE_NOT_FOUND');

  await prisma.mealFeedback.create({
    data: {
      moduleId,
      dayIndex,
      mealType,
      feedback,
    },
  });
}
