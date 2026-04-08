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

export async function startPlanGeneration(userId: string, goalId: string): Promise<string> {
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

  // Create plan record with "generating" status
  const plan = await prisma.nutritionPlan.create({
    data: {
      goalId,
      generationStatus: 'generating',
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

  // Kick off generation in the background — do NOT await
  runPlanGeneration(plan.id, userId, goal.goalType, context, modulesToGenerate).catch(err => {
    console.error(`[Plan] Background generation failed for plan ${plan.id}:`, err.message);
  });

  return plan.id;
}

async function runPlanGeneration(
  planId: string,
  userId: string,
  goalType: string,
  context: any,
  modulesToGenerate: ModuleType[]
): Promise<void> {
  // Pre-create all module records so the status endpoint can track them immediately
  const moduleRecords = await Promise.all(
    modulesToGenerate.map(moduleType =>
      prisma.planModule.create({
        data: {
          planId,
          moduleType,
          moduleData: { pending: true },
          // REMOVED: generationStartedAt so they don't all look "active" at once
        },
      })
    )
  );

  let completedCount = 0;

  for (const moduleRecord of moduleRecords) {
    // 1. Mark ONLY this specific module as actively generating for the frontend
    await prisma.planModule.update({
      where: { id: moduleRecord.id },
      data: { generationStartedAt: new Date() }
    });

    const startMs = Date.now();
    try {
      // 2. Generate the content via Ollama
      const moduleData = await generateModule(moduleRecord.moduleType as ModuleType, context);

      // 3. Save the completed module and record how long it took
      await prisma.planModule.update({
        where: { id: moduleRecord.id },
        data: {
          moduleData,
          generationMs: Date.now() - startMs,
        },
      });
      completedCount++;
    } catch (err: any) {
      console.error(`[Plan] Failed to generate module ${moduleRecord.moduleType}:`, err.message);
      await prisma.planModule.update({
        where: { id: moduleRecord.id },
        data: {
          moduleData: { error: true, message: err.message },
          generationMs: Date.now() - startMs,
        },
      });
    }
  }

  await prisma.nutritionPlan.update({
    where: { id: planId },
    data: { generationStatus: 'complete' },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      eventType: AUDIT_EVENTS.PLAN_GENERATED,
      metadata: {
        planId,
        goalType,
        modulesGenerated: modulesToGenerate.length,
        modulesCompleted: completedCount,
      },
    },
  });
}

export async function getPlanStatus(userId: string, planId: string) {
  const plan = await prisma.nutritionPlan.findFirst({
    where: { id: planId, goal: { userId } },
    select: {
      id: true,
      generationStatus: true,
      goal: { select: { goalType: true } },
      modules: {
        select: {
          id: true,
          moduleType: true,
          generationStartedAt: true,
          generationMs: true,
        },
        orderBy: { generationStartedAt: 'asc' },
      },
    },
  });

  if (!plan) throw new Error('PLAN_NOT_FOUND');

  const expectedModuleTypes = GOAL_MODULES[plan.goal.goalType as GoalType] || [];

  // Completed = has generationMs recorded
  const completedModules = plan.modules
    .filter(m => m.generationMs !== null)
    .map(m => ({ id: m.id, moduleType: m.moduleType, generationMs: m.generationMs }));

  // Active = started but not yet finished
  const activeModule = plan.modules.find(m => m.generationStartedAt && m.generationMs === null);

  // Historical averages per module type across ALL plans (to estimate pending modules)
  const historicalAvgs = await prisma.planModule.groupBy({
    by: ['moduleType'],
    where: { generationMs: { not: null } },
    _avg: { generationMs: true },
    _count: { generationMs: true },
  });

  const moduleEstimates: Record<string, { avgMs: number; sampleCount: number } | null> = {};
  for (const row of historicalAvgs) {
    if (row._avg.generationMs !== null) {
      moduleEstimates[row.moduleType] = {
        avgMs: Math.round(row._avg.generationMs),
        sampleCount: row._count.generationMs,
      };
    }
  }

  return {
    planId: plan.id,
    status: plan.generationStatus,
    completedModules,
    activeModule: activeModule
      ? { moduleType: activeModule.moduleType, startedAt: activeModule.generationStartedAt }
      : null,
    expectedModuleTypes,
    totalModules: expectedModuleTypes.length,
    moduleEstimates,
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
