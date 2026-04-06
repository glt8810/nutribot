"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccountSchema = exports.mfaDisableSchema = exports.mfaSetupConfirmSchema = exports.changePasswordSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.resendVerificationSchema = exports.verifyEmailSchema = exports.mfaVerifySchema = exports.loginSchema = exports.registerSchema = exports.passwordSchema = void 0;
const zod_1 = require("zod");
const constants_1 = require("../lib/constants");
exports.passwordSchema = zod_1.z.string()
    .min(constants_1.PASSWORD_MIN_LENGTH, `Password must be at least ${constants_1.PASSWORD_MIN_LENGTH} characters`)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').max(255),
    password: exports.passwordSchema,
    confirmPassword: zod_1.z.string(),
    fullName: zod_1.z.string().min(1, 'Name is required').max(200),
    dateOfBirth: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    consentVersion: zod_1.z.string().min(1),
    referralSource: zod_1.z.string().max(200).optional(),
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
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.mfaVerifySchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    code: zod_1.z.string().min(6).max(8),
});
exports.verifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
});
exports.resendVerificationSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    password: exports.passwordSchema,
    confirmPassword: zod_1.z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: exports.passwordSchema,
    confirmNewPassword: zod_1.z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
});
exports.mfaSetupConfirmSchema = zod_1.z.object({
    code: zod_1.z.string().length(6, 'TOTP code must be 6 digits'),
});
exports.mfaDisableSchema = zod_1.z.object({
    password: zod_1.z.string().min(1),
});
exports.deleteAccountSchema = zod_1.z.object({
    password: zod_1.z.string().min(1),
});
//# sourceMappingURL=auth.js.map