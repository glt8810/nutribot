import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RATE_LIMITS } from '../lib/constants';
import type { AuthRequest } from './auth';

export const registrationLimiter = rateLimit({
  windowMs: RATE_LIMITS.REGISTRATION_PER_IP.windowMs,
  max: RATE_LIMITS.REGISTRATION_PER_IP.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
  keyGenerator: (req) => req.ip || 'unknown',
});

export const loginLimiter = rateLimit({
  windowMs: RATE_LIMITS.LOGIN_PER_IP.windowMs,
  max: RATE_LIMITS.LOGIN_PER_IP.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
  keyGenerator: (req) => req.ip || 'unknown',
});

export const verificationResendLimiter = rateLimit({
  windowMs: RATE_LIMITS.VERIFICATION_RESEND.windowMs,
  max: RATE_LIMITS.VERIFICATION_RESEND.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification email requests. Please try again later.' },
  keyGenerator: (req) => req.body?.email || req.ip || 'unknown',
});

export const passwordResetLimiter = rateLimit({
  windowMs: RATE_LIMITS.RESET_PER_IP.windowMs,
  max: RATE_LIMITS.RESET_PER_IP.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again later.' },
  keyGenerator: (req) => req.ip || 'unknown',
});

export const unauthenticatedLimiter = rateLimit({
  windowMs: RATE_LIMITS.UNAUTHENTICATED.windowMs,
  max: RATE_LIMITS.UNAUTHENTICATED.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  keyGenerator: (req) => req.ip || 'unknown',
});

export const authenticatedLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTHENTICATED.windowMs,
  max: RATE_LIMITS.AUTHENTICATED.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  keyGenerator: (req: AuthRequest) => req.userId || req.ip || 'unknown',
});

export const aiGenerationLimiter = rateLimit({
  windowMs: RATE_LIMITS.AI_GENERATION.windowMs,
  max: RATE_LIMITS.AI_GENERATION.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Plan generation limit reached. Please try again later.' },
  keyGenerator: (req: AuthRequest) => `ai:${req.userId || req.ip || 'unknown'}`,
});
