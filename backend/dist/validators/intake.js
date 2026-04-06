"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mealFeedbackSchema = exports.regenerateMealSchema = exports.moduleIdParamSchema = exports.planIdParamSchema = exports.goalIdParamSchema = exports.saveIntakeSchema = exports.createGoalSchema = void 0;
const zod_1 = require("zod");
const constants_1 = require("../lib/constants");
exports.createGoalSchema = zod_1.z.object({
    goalType: zod_1.z.enum(constants_1.GOAL_TYPES),
});
exports.saveIntakeSchema = zod_1.z.object({
    section: zod_1.z.enum(constants_1.INTAKE_SECTIONS),
    responses: zod_1.z.record(zod_1.z.any()),
});
exports.goalIdParamSchema = zod_1.z.object({
    goalId: zod_1.z.string().uuid(),
});
exports.planIdParamSchema = zod_1.z.object({
    planId: zod_1.z.string().uuid(),
});
exports.moduleIdParamSchema = zod_1.z.object({
    moduleId: zod_1.z.string().uuid(),
});
exports.regenerateMealSchema = zod_1.z.object({
    dayIndex: zod_1.z.number().int().min(0).max(6),
    mealType: zod_1.z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
});
exports.mealFeedbackSchema = zod_1.z.object({
    dayIndex: zod_1.z.number().int().min(0).max(6),
    mealType: zod_1.z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    feedback: zod_1.z.enum(['liked', 'disliked', 'regenerated']),
});
//# sourceMappingURL=intake.js.map