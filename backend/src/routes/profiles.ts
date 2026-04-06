import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { createProfileSchema, saveIntakeSchema } from '../validators/intake';
import { encryptJSON, decryptJSON } from '../services/crypto.service';
import prisma from '../lib/prisma';
import { INTAKE_SECTIONS } from '../lib/constants';

const router = Router();

// POST /profiles - Create a new profile
router.post('/', authMiddleware, validateBody(createProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.profile.create({
      data: { userId: req.userId!, name: req.body.name },
    });
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create profile.' });
  }
});

// GET /profiles - List user's profiles
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profiles = await prisma.profile.findMany({
      where: { userId: req.userId! },
      include: { intakeResponses: { select: { section: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const profilesWithProgress = profiles.map(p => ({
      ...p,
      intakeComplete: INTAKE_SECTIONS.every(s => p.intakeResponses.some(r => r.section === s)),
    }));
    res.json(profilesWithProgress);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profiles.' });
  }
});

// POST /profiles/:profileId/intake - Save intake
router.post('/:profileId/intake', authMiddleware, validateBody(saveIntakeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.profile.findFirst({ where: { id: req.params.profileId as string, userId: req.userId! }});
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });

    const { section, responses } = req.body;
    const responsesEnc = encryptJSON(responses);

    const existing = await prisma.intakeResponse.findFirst({ where: { profileId: profile.id, section } });
    if (existing) {
      await prisma.intakeResponse.update({ where: { id: existing.id }, data: { responsesEnc, completedAt: new Date() } });
    } else {
      await prisma.intakeResponse.create({ data: { profileId: profile.id, section, responsesEnc } });
    }
    res.json({ message: 'Saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save.' });
  }
});

// GET /profiles/:profileId/intake - Get intake
router.get('/:profileId/intake', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.profile.findFirst({ where: { id: req.params.profileId as string, userId: req.userId! }});
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });

    const responses = await prisma.intakeResponse.findMany({ where: { profileId: profile.id } });
    const decrypted = responses.map(r => ({ section: r.section, responses: decryptJSON(r.responsesEnc) }));
    const completedSections = decrypted.map(r => r.section);
    const isComplete = INTAKE_SECTIONS.every(s => completedSections.includes(s));

    res.json({ profileId: profile.id, sections: decrypted, completedSections, isComplete });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load.' });
  }
});

export default router;
