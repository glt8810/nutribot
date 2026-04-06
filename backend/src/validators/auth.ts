import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '../lib/constants';

export const passwordSchema = z.string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: passwordSchema,
  confirmPassword: z.string(),
  fullName: z.string().min(1, 'Name is required').max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  consentVersion: z.string().min(1),
  referralSource: z.string().max(200).optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine(data => {
  const dob = new Date(data.dateOfBirth);
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  return age >= 13;
}, {
  message: 'You must be at least 13 years old',
  path: ['dateOfBirth'],
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const mfaVerifySchema = z.object({
  userId: z.string().uuid(),
  code: z.string().min(6).max(8),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
});

export const mfaSetupConfirmSchema = z.object({
  code: z.string().length(6, 'TOTP code must be 6 digits'),
});

export const mfaDisableSchema = z.object({
  password: z.string().min(1),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1).optional(),
});

export const completeProfileSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
}).refine(data => {
  const dob = new Date(data.dateOfBirth);
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  return age >= 13;
}, {
  message: 'You must be at least 13 years old',
  path: ['dateOfBirth'],
});

export const updateProfileSchema = z.object({
  measurementSystem: z.enum(['metric', 'imperial']),
});
