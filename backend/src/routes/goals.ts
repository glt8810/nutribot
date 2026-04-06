import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { createGoalSchema, saveExtrasSchema } from '../validators/intake';
import { encryptJSON, decryptJSON } from '../services/crypto.service';
import prisma from '../lib/prisma';
// Removed INTAKE_SECTIONS import

const router = Router();

// POST /goals — Create a new goal
router.post('/', authMiddleware, validateBody(createGoalSchema), async (req: AuthRequest, res: Response) => {
  try {
    // Check email verification
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { emailVerified: true } });
    if (!user?.emailVerified) {
      return res.status(403).json({ error: 'Please verify your email before creating a plan.' });
    }

    const goal = await prisma.goal.create({
      data: {
        userId: req.userId!,
        profileId: req.body.profileId,
        goalType: req.body.goalType,
      },
    });

    res.status(201).json(goal);
  } catch (err) {
    console.error('[Goals] Create error:', err);
    res.status(500).json({ error: 'Failed to create goal.' });
  }
});

// GET /goals — List user's goals
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.userId! },
      include: {
        nutritionPlans: {
          select: { id: true, isActive: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { selectedAt: 'desc' },
    });

    const goalsWithPlans = goals.map(g => ({
      ...g,
      hasPlan: g.nutritionPlans.length > 0,
    }));

    res.json(goalsWithPlans);
  } catch (err) {
    console.error('[Goals] List error:', err);
    res.status(500).json({ error: 'Failed to load goals.' });
  }
});

// POST /goals/:goalId/extras - Save goal extras
router.post('/:goalId/extras', authMiddleware, validateBody(saveExtrasSchema), async (req: AuthRequest, res: Response) => {
  try {
    const goal = await prisma.goal.findFirst({ where: { id: req.params.goalId as string, userId: req.userId! } });
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });

    const extrasEnc = encryptJSON(req.body.extras);
    await prisma.goal.update({ where: { id: goal.id }, data: { extrasEnc } });
    
    res.json({ message: 'Extras saved.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save extras.' });
  }
});

// DELETE /goals/:goalId — Delete a goal
router.delete('/:goalId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.goalId as string, userId: req.userId! },
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    await prisma.goal.delete({ where: { id: goal.id } });
    res.json({ message: 'Goal deleted.' });
  } catch (err) {
    console.error('[Goals] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete goal.' });
  }
});

export default router;
