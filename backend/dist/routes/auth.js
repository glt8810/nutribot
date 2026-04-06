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
const validation_1 = require("../middleware/validation");
const auth_1 = require("../middleware/auth");
const rate_limit_1 = require("../middleware/rate-limit");
const auth_2 = require("../validators/auth");
const auth_service_1 = require("../services/auth.service");
const QRCode = __importStar(require("qrcode"));
const router = (0, express_1.Router)();
const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
// POST /auth/register
router.post('/register', rate_limit_1.registrationLimiter, (0, validation_1.validateBody)(auth_2.registerSchema), async (req, res) => {
    try {
        const { email, password, fullName, dateOfBirth, consentVersion, referralSource } = req.body;
        // Check password doesn't contain name or email handle
        const emailHandle = email.split('@')[0].toLowerCase();
        const nameLower = fullName.toLowerCase();
        if (password.toLowerCase().includes(emailHandle) || password.toLowerCase().includes(nameLower)) {
            return res.status(400).json({ error: 'Password must not contain your name or email' });
        }
        // Check password breach
        const isBreached = await (0, auth_service_1.checkPasswordBreach)(password);
        if (isBreached) {
            return res.status(400).json({
                error: 'This password has appeared in a data breach. Please choose a different password.',
            });
        }
        const result = await (0, auth_service_1.registerUser)({ email, password, fullName, dateOfBirth, consentVersion, referralSource }, req.ip);
        res.status(201).json({
            message: 'Account created. Please check your email to verify your account.',
            userId: result.userId,
        });
    }
    catch (err) {
        if (err.message === 'EMAIL_EXISTS') {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }
        console.error('[Auth] Registration error:', err);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});
// POST /auth/login
router.post('/login', rate_limit_1.loginLimiter, (0, validation_1.validateBody)(auth_2.loginSchema), async (req, res) => {
    try {
        const result = await (0, auth_service_1.loginUser)({
            email: req.body.email,
            password: req.body.password,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
        if ('requireMfa' in result && result.requireMfa) {
            return res.json({ requireMfa: true, userId: result.userId });
        }
        if (!('refreshToken' in result) || !('accessToken' in result)) {
            throw new Error('Unexpected result from loginUser');
        }
        // Set refresh token cookie
        res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
        res.json({
            accessToken: result.accessToken,
            userId: result.userId,
        });
    }
    catch (err) {
        if (err.message === 'INVALID_CREDENTIALS') {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        if (err.message === 'ACCOUNT_LOCKED') {
            return res.status(423).json({ error: 'Account temporarily locked. Please try again in 15 minutes.' });
        }
        if (err.message === 'ACCOUNT_LOCKED_PERMANENT') {
            return res.status(423).json({ error: 'Account locked. Please reset your password or contact support.' });
        }
        console.error('[Auth] Login error:', err);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});
// POST /auth/mfa/verify
router.post('/mfa/verify', rate_limit_1.loginLimiter, (0, validation_1.validateBody)(auth_2.mfaVerifySchema), async (req, res) => {
    try {
        const result = await (0, auth_service_1.completeMfaLogin)(req.body.userId, req.body.code, req.ip, req.headers['user-agent']);
        res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
        res.json({ accessToken: result.accessToken, userId: result.userId });
    }
    catch (err) {
        if (err.message === 'INVALID_MFA_CODE') {
            return res.status(401).json({ error: 'Invalid MFA code.' });
        }
        console.error('[Auth] MFA verify error:', err);
        res.status(500).json({ error: 'MFA verification failed.' });
    }
});
// POST /auth/refresh
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ error: 'No refresh token', code: 'NO_REFRESH_TOKEN' });
        }
        const result = await (0, auth_service_1.refreshSession)(refreshToken, req.ip, req.headers['user-agent']);
        res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
        res.json({ accessToken: result.accessToken });
    }
    catch (err) {
        if (err.message === 'INVALID_REFRESH_TOKEN') {
            res.clearCookie('refreshToken', { path: '/auth/refresh' });
            return res.status(401).json({ error: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
        }
        console.error('[Auth] Refresh error:', err);
        res.status(500).json({ error: 'Token refresh failed.' });
    }
});
// POST /auth/logout
router.post('/logout', async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
            await (0, auth_service_1.logout)(refreshToken);
        }
        res.clearCookie('refreshToken', { path: '/auth/refresh' });
        res.json({ message: 'Logged out successfully' });
    }
    catch (err) {
        console.error('[Auth] Logout error:', err);
        res.json({ message: 'Logged out' });
    }
});
// POST /auth/logout-all
router.post('/logout-all', auth_1.authMiddleware, async (req, res) => {
    try {
        await (0, auth_service_1.logoutAll)(req.userId);
        res.clearCookie('refreshToken', { path: '/auth/refresh' });
        res.json({ message: 'All sessions terminated' });
    }
    catch (err) {
        console.error('[Auth] Logout all error:', err);
        res.status(500).json({ error: 'Failed to terminate all sessions.' });
    }
});
// POST /auth/verify-email
router.post('/verify-email', (0, validation_1.validateBody)(auth_2.verifyEmailSchema), async (req, res) => {
    try {
        await (0, auth_service_1.verifyEmail)(req.body.token);
        res.json({ message: 'Email verified successfully!' });
    }
    catch (err) {
        if (err.message === 'INVALID_OR_EXPIRED_TOKEN') {
            return res.status(400).json({ error: 'Invalid or expired verification link.' });
        }
        console.error('[Auth] Verify email error:', err);
        res.status(500).json({ error: 'Verification failed.' });
    }
});
// POST /auth/resend-verification
router.post('/resend-verification', rate_limit_1.verificationResendLimiter, (0, validation_1.validateBody)(auth_2.resendVerificationSchema), async (req, res) => {
    try {
        await (0, auth_service_1.resendVerification)(req.body.email);
        res.json({ message: 'If an account exists with that email, a verification link has been sent.' });
    }
    catch (err) {
        console.error('[Auth] Resend verification error:', err);
        res.json({ message: 'If an account exists with that email, a verification link has been sent.' });
    }
});
// POST /auth/forgot-password
router.post('/forgot-password', rate_limit_1.passwordResetLimiter, (0, validation_1.validateBody)(auth_2.forgotPasswordSchema), async (req, res) => {
    try {
        await (0, auth_service_1.requestPasswordReset)(req.body.email, req.ip);
        res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    }
    catch (err) {
        console.error('[Auth] Forgot password error:', err);
        res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    }
});
// POST /auth/reset-password
router.post('/reset-password', rate_limit_1.passwordResetLimiter, (0, validation_1.validateBody)(auth_2.resetPasswordSchema), async (req, res) => {
    try {
        await (0, auth_service_1.resetPassword)(req.body.token, req.body.password, req.ip);
        res.json({ message: 'Password reset successfully. Please log in with your new password.' });
    }
    catch (err) {
        if (err.message === 'INVALID_OR_EXPIRED_TOKEN') {
            return res.status(400).json({ error: 'Invalid or expired reset link.' });
        }
        console.error('[Auth] Reset password error:', err);
        res.status(500).json({ error: 'Password reset failed.' });
    }
});
// POST /auth/change-password (authenticated)
router.post('/change-password', auth_1.authMiddleware, (0, validation_1.validateBody)(auth_2.changePasswordSchema), async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        await (0, auth_service_1.changePassword)(req.userId, req.body.currentPassword, req.body.newPassword, refreshToken);
        res.json({ message: 'Password changed successfully. Other sessions have been logged out.' });
    }
    catch (err) {
        if (err.message === 'INVALID_PASSWORD') {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }
        console.error('[Auth] Change password error:', err);
        res.status(500).json({ error: 'Password change failed.' });
    }
});
// GET /auth/mfa/setup (authenticated)
router.get('/mfa/setup', auth_1.authMiddleware, async (req, res) => {
    try {
        const result = await (0, auth_service_1.setupMfa)(req.userId);
        const qrCodeDataUrl = await QRCode.toDataURL(result.otpauthUrl);
        res.json({ qrCode: qrCodeDataUrl, backupCodes: result.backupCodes });
    }
    catch (err) {
        console.error('[Auth] MFA setup error:', err);
        res.status(500).json({ error: 'MFA setup failed.' });
    }
});
// POST /auth/mfa/confirm (authenticated)
router.post('/mfa/confirm', auth_1.authMiddleware, (0, validation_1.validateBody)(auth_2.mfaSetupConfirmSchema), async (req, res) => {
    try {
        await (0, auth_service_1.confirmMfa)(req.userId, req.body.code);
        res.json({ message: 'MFA enabled successfully!' });
    }
    catch (err) {
        if (err.message === 'INVALID_MFA_CODE') {
            return res.status(400).json({ error: 'Invalid code. Please try again.' });
        }
        if (err.message === 'MFA_SETUP_EXPIRED') {
            return res.status(400).json({ error: 'Setup expired. Please start MFA setup again.' });
        }
        console.error('[Auth] MFA confirm error:', err);
        res.status(500).json({ error: 'MFA confirmation failed.' });
    }
});
// POST /auth/mfa/disable (authenticated)
router.post('/mfa/disable', auth_1.authMiddleware, (0, validation_1.validateBody)(auth_2.mfaDisableSchema), async (req, res) => {
    try {
        await (0, auth_service_1.disableMfa)(req.userId, req.body.password);
        res.json({ message: 'MFA disabled.' });
    }
    catch (err) {
        if (err.message === 'INVALID_PASSWORD') {
            return res.status(401).json({ error: 'Incorrect password.' });
        }
        console.error('[Auth] MFA disable error:', err);
        res.status(500).json({ error: 'Failed to disable MFA.' });
    }
});
// GET /auth/profile (authenticated)
router.get('/profile', auth_1.authMiddleware, async (req, res) => {
    try {
        const profile = await (0, auth_service_1.getUserProfile)(req.userId);
        res.json(profile);
    }
    catch (err) {
        console.error('[Auth] Profile error:', err);
        res.status(500).json({ error: 'Failed to load profile.' });
    }
});
// GET /auth/sessions (authenticated)
router.get('/sessions', auth_1.authMiddleware, async (req, res) => {
    try {
        const sessions = await (0, auth_service_1.getActiveSessions)(req.userId);
        res.json(sessions);
    }
    catch (err) {
        console.error('[Auth] Sessions error:', err);
        res.status(500).json({ error: 'Failed to load sessions.' });
    }
});
// DELETE /auth/sessions/:sessionId (authenticated)
router.delete('/sessions/:sessionId', auth_1.authMiddleware, async (req, res) => {
    try {
        await (0, auth_service_1.revokeSession)(req.userId, req.params.sessionId);
        res.json({ message: 'Session revoked.' });
    }
    catch (err) {
        console.error('[Auth] Revoke session error:', err);
        res.status(500).json({ error: 'Failed to revoke session.' });
    }
});
// GET /auth/export-data (authenticated)
router.get('/export-data', auth_1.authMiddleware, async (req, res) => {
    try {
        const data = await (0, auth_service_1.exportUserData)(req.userId);
        res.json(data);
    }
    catch (err) {
        console.error('[Auth] Export error:', err);
        res.status(500).json({ error: 'Failed to export data.' });
    }
});
// POST /auth/delete-account (authenticated)
router.post('/delete-account', auth_1.authMiddleware, (0, validation_1.validateBody)(auth_2.deleteAccountSchema), async (req, res) => {
    try {
        await (0, auth_service_1.deleteAccount)(req.userId, req.body.password);
        res.clearCookie('refreshToken', { path: '/auth/refresh' });
        res.json({ message: 'Account scheduled for deletion. You have 30 days to cancel by logging in.' });
    }
    catch (err) {
        if (err.message === 'INVALID_PASSWORD') {
            return res.status(401).json({ error: 'Incorrect password.' });
        }
        console.error('[Auth] Delete account error:', err);
        res.status(500).json({ error: 'Failed to delete account.' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map