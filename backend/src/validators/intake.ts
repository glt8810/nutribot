import { z } from 'zod';
import { GOAL_TYPES, INTAKE_SECTIONS } from '../lib/constants';

export const createGoalSchema = z.object({
  goalType: z.enum(GOAL_TYPES as any),
  profileId: z.string().uuid(),
});

export const saveIntakeSchema = z.object({
  section: z.enum(INTAKE_SECTIONS as any),
  responses: z.record(z.any()),
});

export const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
});

export const saveExtrasSchema = z.object({
  extras: z.record(z.any()),
});

export const goalIdParamSchema = z.object({
  goalId: z.string().uuid(),
});

export const planIdParamSchema = z.object({
  planId: z.string().uuid(),
});

export const moduleIdParamSchema = z.object({
  moduleId: z.string().uuid(),
});

export const regenerateMealSchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
});

export const mealFeedbackSchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  feedback: z.enum(['liked', 'disliked', 'regenerated']),
});
