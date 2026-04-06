"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rate_limit_1 = require("../middleware/rate-limit");
const validation_1 = require("../middleware/validation");
const intake_1 = require("../validators/intake");
const plan_service_1 = require("../services/plan.service");
const router = (0, express_1.Router)();
// POST /plans/generate/:goalId — Generate a full plan
router.post('/generate/:goalId', auth_1.authMiddleware, rate_limit_1.aiGenerationLimiter, async (req, res) => {
    try {
        // Check email verification
        const prisma = (await Promise.resolve().then(() => __importStar(require('../lib/prisma')))).default;
        const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { emailVerified: true } });
        if (!user?.emailVerified) {
            return res.status(403).json({ error: 'Please verify your email to generate plans.' });
        }
        const result = await (0, plan_service_1.generatePlan)(req.userId, req.params.goalId);
        res.json(result);
    }
    catch (err) {
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
// GET /plans — List user's plans
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const plans = await (0, plan_service_1.getUserPlans)(req.userId);
        res.json(plans);
    }
    catch (err) {
        console.error('[Plans] List error:', err);
        res.status(500).json({ error: 'Failed to load plans.' });
    }
});
// GET /plans/active — Get the active plan
router.get('/active', auth_1.authMiddleware, async (req, res) => {
    try {
        const plan = await (0, plan_service_1.getActivePlan)(req.userId);
        if (!plan) {
            return res.status(404).json({ error: 'No active plan found.' });
        }
        res.json(plan);
    }
    catch (err) {
        console.error('[Plans] Active plan error:', err);
        res.status(500).json({ error: 'Failed to load active plan.' });
    }
});
// GET /plans/:planId — Get a specific plan
router.get('/:planId', auth_1.authMiddleware, async (req, res) => {
    try {
        const plan = await (0, plan_service_1.getPlan)(req.userId, req.params.planId);
        res.json(plan);
    }
    catch (err) {
        if (err.message === 'PLAN_NOT_FOUND') {
            return res.status(404).json({ error: 'Plan not found.' });
        }
        console.error('[Plans] Get plan error:', err);
        res.status(500).json({ error: 'Failed to load plan.' });
    }
});
// POST /plans/:planId/modules/:moduleId/regenerate — Regenerate a module
router.post('/:planId/modules/:moduleId/regenerate', auth_1.authMiddleware, rate_limit_1.aiGenerationLimiter, async (req, res) => {
    try {
        const data = await (0, plan_service_1.regenerateModule)(req.userId, req.params.planId, req.params.moduleId);
        res.json(data);
    }
    catch (err) {
        if (err.message === 'MODULE_NOT_FOUND') {
            return res.status(404).json({ error: 'Module not found.' });
        }
        console.error('[Plans] Regenerate module error:', err);
        res.status(500).json({ error: 'Module regeneration failed.' });
    }
});
// POST /plans/:planId/modules/:moduleId/regenerate-meal — Regenerate a single meal
router.post('/:planId/modules/:moduleId/regenerate-meal', auth_1.authMiddleware, (0, validation_1.validateBody)(intake_1.regenerateMealSchema), async (req, res) => {
    try {
        const meal = await (0, plan_service_1.regenerateSingleMeal)(req.userId, req.params.planId, req.params.moduleId, req.body.dayIndex, req.body.mealType);
        res.json(meal);
    }
    catch (err) {
        if (err.message === 'MODULE_NOT_FOUND') {
            return res.status(404).json({ error: 'Meal plan module not found.' });
        }
        console.error('[Plans] Regenerate meal error:', err);
        res.status(500).json({ error: 'Meal regeneration failed.' });
    }
});
// POST /plans/modules/:moduleId/feedback — Add meal feedback
router.post('/modules/:moduleId/feedback', auth_1.authMiddleware, (0, validation_1.validateBody)(intake_1.mealFeedbackSchema), async (req, res) => {
    try {
        await (0, plan_service_1.addMealFeedback)(req.userId, req.params.moduleId, req.body.dayIndex, req.body.mealType, req.body.feedback);
        res.json({ message: 'Feedback recorded.' });
    }
    catch (err) {
        if (err.message === 'MODULE_NOT_FOUND') {
            return res.status(404).json({ error: 'Module not found.' });
        }
        console.error('[Plans] Feedback error:', err);
        res.status(500).json({ error: 'Failed to record feedback.' });
    }
});
exports.default = router;
//# sourceMappingURL=plans.js.map