import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { aiGenerationLimiter } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validation';
import { regenerateMealSchema, mealFeedbackSchema } from '../validators/intake';
import {
  startPlanGeneration,
  getPlanStatus,
  getPlan,
  getActivePlan,
  getUserPlans,
  regenerateModule,
  regenerateSingleMeal,
  addMealFeedback,
} from '../services/plan.service';

const router = Router();

// POST /plans/generate/:goalId — Kick off async plan generation
router.post('/generate/:goalId', authMiddleware, aiGenerationLimiter, async (req: AuthRequest, res: Response) => {
  try {
    // Check email verification
    const prisma = (await import('../lib/prisma')).default;
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { emailVerified: true } });
    if (!user?.emailVerified) {
      return res.status(403).json({ error: 'Please verify your email to generate plans.' });
    }

    const planId = await startPlanGeneration(req.userId!, req.params.goalId as string);
    res.json({ planId, status: 'generating' });
  } catch (err: any) {
    if (err.message === 'GOAL_NOT_FOUND') {
      return res.status(404).json({ error: 'Goal not found.' });
    }
    if (err.message === 'INTAKE_INCOMPLETE') {
      return res.status(400).json({ error: 'Please complete all intake sections before generating a plan.' });
    }
    console.error('[Plans] Generate error:', err);
    res.status(500).json({ error: 'Plan generation failed. Please try again.' });
  }
});

// GET /plans/:planId/status — Poll generation progress
router.get('/:planId/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await getPlanStatus(req.userId!, req.params.planId as string);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'PLAN_NOT_FOUND') {
      return res.status(404).json({ error: 'Plan not found.' });
    }
    console.error('[Plans] Status error:', err);
    res.status(500).json({ error: 'Failed to get plan status.' });
  }
});

// GET /plans — List user's plans
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const plans = await getUserPlans(req.userId!);
    res.json(plans);
  } catch (err) {
    console.error('[Plans] List error:', err);
    res.status(500).json({ error: 'Failed to load plans.' });
  }
});

// GET /plans/active — Get the active plan
router.get('/active', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const plan = await getActivePlan(req.userId!);
    if (!plan) {
      return res.status(404).json({ error: 'No active plan found.' });
    }
    res.json(plan);
  } catch (err) {
    console.error('[Plans] Active plan error:', err);
    res.status(500).json({ error: 'Failed to load active plan.' });
  }
});

// GET /plans/:planId — Get a specific plan
router.get('/:planId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const plan = await getPlan(req.userId!, req.params.planId as string);
    res.json(plan);
  } catch (err: any) {
    if (err.message === 'PLAN_NOT_FOUND') {
      return res.status(404).json({ error: 'Plan not found.' });
    }
    console.error('[Plans] Get plan error:', err);
    res.status(500).json({ error: 'Failed to load plan.' });
  }
});

// POST /plans/:planId/modules/:moduleId/regenerate — Regenerate a module
router.post('/:planId/modules/:moduleId/regenerate', authMiddleware, aiGenerationLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = await regenerateModule(req.userId!, req.params.planId as string, req.params.moduleId as string);
    res.json(data);
  } catch (err: any) {
    if (err.message === 'MODULE_NOT_FOUND') {
      return res.status(404).json({ error: 'Module not found.' });
    }
    console.error('[Plans] Regenerate module error:', err);
    res.status(500).json({ error: 'Module regeneration failed.' });
  }
});

// POST /plans/:planId/modules/:moduleId/regenerate-meal — Regenerate a single meal
router.post('/:planId/modules/:moduleId/regenerate-meal', authMiddleware, validateBody(regenerateMealSchema), async (req: AuthRequest, res: Response) => {
  try {
    const meal = await regenerateSingleMeal(
      req.userId!,
      req.params.planId as string,
      req.params.moduleId as string,
      req.body.dayIndex,
      req.body.mealType
    );
    res.json(meal);
  } catch (err: any) {
    if (err.message === 'MODULE_NOT_FOUND') {
      return res.status(404).json({ error: 'Meal plan module not found.' });
    }
    console.error('[Plans] Regenerate meal error:', err);
    res.status(500).json({ error: 'Meal regeneration failed.' });
  }
});

// POST /plans/modules/:moduleId/feedback — Add meal feedback
router.post('/modules/:moduleId/feedback', authMiddleware, validateBody(mealFeedbackSchema), async (req: AuthRequest, res: Response) => {
  try {
    await addMealFeedback(req.userId!, req.params.moduleId as string, req.body.dayIndex, req.body.mealType, req.body.feedback);
    res.json({ message: 'Feedback recorded.' });
  } catch (err: any) {
    if (err.message === 'MODULE_NOT_FOUND') {
      return res.status(404).json({ error: 'Module not found.' });
    }
    console.error('[Plans] Feedback error:', err);
    res.status(500).json({ error: 'Failed to record feedback.' });
  }
});

export default router;
