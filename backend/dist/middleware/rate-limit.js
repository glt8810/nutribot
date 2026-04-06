"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiGenerationLimiter = exports.authenticatedLimiter = exports.unauthenticatedLimiter = exports.passwordResetLimiter = exports.verificationResendLimiter = exports.loginLimiter = exports.registrationLimiter = void 0;
const express_rate_limit_1 = require("express-rate-limit");
const constants_1 = require("../lib/constants");
exports.registrationLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: constants_1.RATE_LIMITS.REGISTRATION_PER_IP.windowMs,
    max: constants_1.RATE_LIMITS.REGISTRATION_PER_IP.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many registration attempts. Please try again later.' },
    keyGenerator: (req) => req.ip || 'unknown',
});
exports.loginLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: constants_1.RATE_LIMITS.LOGIN_PER_IP.windowMs,
    max: constants_1.RATE_LIMITS.LOGIN_PER_IP.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again later.' },
    keyGenerator: (req) => req.ip || 'unknown',
});
exports.verificationResendLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: constants_1.RATE_LIMITS.VERIFICATION_RESEND.windowMs,
    max: constants_1.RATE_LIMITS.VERIFICATION_RESEND.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many verification email requests. Please try again later.' },
    keyGenerator: (req) => req.body?.email || req.ip || 'unknown',
});
exports.passwordResetLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: constants_1.RATE_LIMITS.RESET_PER_IP.windowMs,
    max: constants_1.RATE_LIMITS.RESET_PER_IP.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password reset requests. Please try again later.' },
    keyGenerator: (req) => req.ip || 'unknown',
});
exports.unauthenticatedLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: constants_1.RATE_LIMITS.UNAUTHENTICATED.windowMs,
    max: constants_1.RATE_LIMITS.UNAUTHENTICATED.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
    keyGenerator: (req) => req.ip || 'unknown',
});
exports.authenticatedLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: constants_1.RATE_LIMITS.AUTHENTICATED.windowMs,
    max: constants_1.RATE_LIMITS.AUTHENTICATED.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
    keyGenerator: (req) => req.userId || req.ip || 'unknown',
});
exports.aiGenerationLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: constants_1.RATE_LIMITS.AI_GENERATION.windowMs,
    max: constants_1.RATE_LIMITS.AI_GENERATION.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Plan generation limit reached. Please try again later.' },
    keyGenerator: (req) => `ai:${req.userId || req.ip || 'unknown'}`,
});
//# sourceMappingURL=rate-limit.js.map