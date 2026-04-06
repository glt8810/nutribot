"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const intake_1 = require("../validators/intake");
const crypto_service_1 = require("../services/crypto.service");
const prisma_1 = __importDefault(require("../lib/prisma"));
const constants_1 = require("../lib/constants");
const router = (0, express_1.Router)();
// POST /goals — Create a new goal
router.post('/', auth_1.authMiddleware, (0, validation_1.validateBody)(intake_1.createGoalSchema), async (req, res) => {
    try {
        // Check email verification
        const user = await prisma_1.default.user.findUnique({ where: { id: req.userId }, select: { emailVerified: true } });
        if (!user?.emailVerified) {
            return res.status(403).json({ error: 'Please verify your email before creating a plan.' });
        }
        const goal = await prisma_1.default.goal.create({
            data: {
                userId: req.userId,
                goalType: req.body.goalType,
            },
        });
        res.status(201).json(goal);
    }
    catch (err) {
        console.error('[Goals] Create error:', err);
        res.status(500).json({ error: 'Failed to create goal.' });
    }
});
// GET /goals — List user's goals
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const goals = await prisma_1.default.goal.findMany({
            where: { userId: req.userId },
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
            intakeComplete: constants_1.INTAKE_SECTIONS.every(s => g.intakeResponses.some(r => r.section === s)),
            hasPlan: g.nutritionPlans.length > 0,
        }));
        res.json(goalsWithProgress);
    }
    catch (err) {
        console.error('[Goals] List error:', err);
        res.status(500).json({ error: 'Failed to load goals.' });
    }
});
// POST /goals/:goalId/intake — Save intake section
router.post('/:goalId/intake', auth_1.authMiddleware, (0, validation_1.validateBody)(intake_1.saveIntakeSchema), async (req, res) => {
    try {
        // Verify goal ownership
        const goal = await prisma_1.default.goal.findFirst({
            where: { id: req.params.goalId, userId: req.userId },
        });
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found.' });
        }
        const { section, responses } = req.body;
        // Encrypt responses
        const responsesEnc = (0, crypto_service_1.encryptJSON)(responses);
        // Upsert — update if section already exists
        const existing = await prisma_1.default.intakeResponse.findFirst({
            where: { goalId: goal.id, section },
        });
        if (existing) {
            await prisma_1.default.intakeResponse.update({
                where: { id: existing.id },
                data: { responsesEnc, completedAt: new Date() },
            });
        }
        else {
            await prisma_1.default.intakeResponse.create({
                data: {
                    goalId: goal.id,
                    section,
                    responsesEnc,
                },
            });
        }
        res.json({ message: `Section "${section}" saved.` });
    }
    catch (err) {
        console.error('[Goals] Save intake error:', err);
        res.status(500).json({ error: 'Failed to save intake data.' });
    }
});
// GET /goals/:goalId/intake — Get intake responses
router.get('/:goalId/intake', auth_1.authMiddleware, async (req, res) => {
    try {
        const goal = await prisma_1.default.goal.findFirst({
            where: { id: req.params.goalId, userId: req.userId },
        });
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found.' });
        }
        const responses = await prisma_1.default.intakeResponse.findMany({
            where: { goalId: goal.id },
        });
        const decrypted = responses.map(r => ({
            id: r.id,
            section: r.section,
            responses: (0, crypto_service_1.decryptJSON)(r.responsesEnc),
            completedAt: r.completedAt,
        }));
        const completedSections = decrypted.map(r => r.section);
        const isComplete = constants_1.INTAKE_SECTIONS.every(s => completedSections.includes(s));
        res.json({
            goalId: goal.id,
            goalType: goal.goalType,
            sections: decrypted,
            completedSections,
            isComplete,
        });
    }
    catch (err) {
        console.error('[Goals] Get intake error:', err);
        res.status(500).json({ error: 'Failed to load intake data.' });
    }
});
// DELETE /goals/:goalId — Delete a goal
router.delete('/:goalId', auth_1.authMiddleware, async (req, res) => {
    try {
        const goal = await prisma_1.default.goal.findFirst({
            where: { id: req.params.goalId, userId: req.userId },
        });
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found.' });
        }
        await prisma_1.default.goal.delete({ where: { id: goal.id } });
        res.json({ message: 'Goal deleted.' });
    }
    catch (err) {
        console.error('[Goals] Delete error:', err);
        res.status(500).json({ error: 'Failed to delete goal.' });
    }
});
exports.default = router;
//# sourceMappingURL=goals.js.map