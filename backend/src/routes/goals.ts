import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { createGoalSchema, saveIntakeSchema } from '../validators/intake';
import { encryptJSON, decryptJSON } from '../services/crypto.service';
import prisma from '../lib/prisma';
import { INTAKE_SECTIONS } from '../lib/constants';

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
        intakeResponses: {
          select: { section: true },
        },
      },
      orderBy: { selectedAt: 'desc' },
    });

    const goalsWithProgress = goals.map(g => ({
      ...g,
      intakeSections: g.intakeResponses.map(r => r.section),
      intakeComplete: INTAKE_SECTIONS.every(s =>
        g.intakeResponses.some(r => r.section === s)
      ),
      hasPlan: g.nutritionPlans.length > 0,
    }));

    res.json(goalsWithProgress);
  } catch (err) {
    console.error('[Goals] List error:', err);
    res.status(500).json({ error: 'Failed to load goals.' });
  }
});

// POST /goals/:goalId/intake — Save intake section
router.post('/:goalId/intake', authMiddleware, validateBody(saveIntakeSchema), async (req: AuthRequest, res: Response) => {
  try {
    // Verify goal ownership
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.goalId as string, userId: req.userId! },
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    const { section, responses } = req.body;

    // Encrypt responses
    const responsesEnc = encryptJSON(responses);

    // Upsert — update if section already exists
    const existing = await prisma.intakeResponse.findFirst({
      where: { goalId: goal.id, section },
    });

    if (existing) {
      await prisma.intakeResponse.update({
        where: { id: existing.id },
        data: { responsesEnc, completedAt: new Date() },
      });
    } else {
      await prisma.intakeResponse.create({
        data: {
          goalId: goal.id,
          section,
          responsesEnc,
        },
      });
    }

    res.json({ message: `Section "${section}" saved.` });
  } catch (err) {
    console.error('[Goals] Save intake error:', err);
    res.status(500).json({ error: 'Failed to save intake data.' });
  }
});

// GET /goals/:goalId/intake — Get intake responses
router.get('/:goalId/intake', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.goalId as string, userId: req.userId! },
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    const responses = await prisma.intakeResponse.findMany({
      where: { goalId: goal.id },
    });

    const decrypted = responses.map(r => ({
      id: r.id,
      section: r.section,
      responses: decryptJSON(r.responsesEnc),
      completedAt: r.completedAt,
    }));

    const completedSections = decrypted.map(r => r.section);
    const isComplete = INTAKE_SECTIONS.every(s => completedSections.includes(s));

    res.json({
      goalId: goal.id,
      goalType: goal.goalType,
      sections: decrypted,
      completedSections,
      isComplete,
    });
  } catch (err) {
    console.error('[Goals] Get intake error:', err);
    res.status(500).json({ error: 'Failed to load intake data.' });
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
