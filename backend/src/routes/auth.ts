import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validation';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  registrationLimiter,
  loginLimiter,
  verificationResendLimiter,
  passwordResetLimiter,
} from '../middleware/rate-limit';
import {
  registerSchema,
  loginSchema,
  mfaVerifySchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  mfaSetupConfirmSchema,
  mfaDisableSchema,
  deleteAccountSchema,
  completeProfileSchema,
  updateProfileSchema,
} from '../validators/auth';
import {
  registerUser,
  loginUser,
  completeMfaLogin,
  refreshSession,
  logout,
  logoutAll,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  changePassword,
  setupMfa,
  confirmMfa,
  disableMfa,
  getUserProfile,
  deleteAccount,
  getActiveSessions,
  revokeSession,
  exportUserData,
  checkPasswordBreach,
  getGoogleAuthUrl,
  handleGoogleCallback,
  completeProfile,
  updateMeasurementSystem,
} from '../services/auth.service';
import * as QRCode from 'qrcode';

const router = Router();

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// POST /auth/register
router.post('/register', registrationLimiter, validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, dateOfBirth, consentVersion, referralSource } = req.body;

    // Check password doesn't contain name or email handle
    const emailHandle = email.split('@')[0].toLowerCase();
    const nameLower = fullName.toLowerCase();
    if (password.toLowerCase().includes(emailHandle) || password.toLowerCase().includes(nameLower)) {
      return res.status(400).json({ error: 'Password must not contain your name or email' });
    }

    // Check password breach
    const isBreached = await checkPasswordBreach(password);
    if (isBreached) {
      return res.status(400).json({
        error: 'This password has appeared in a data breach. Please choose a different password.',
      });
    }

    const result = await registerUser(
      { email, password, fullName, dateOfBirth, consentVersion, referralSource },
      req.ip
    );

    res.status(201).json({
      message: 'Account created. Please check your email to verify your account.',
      userId: result.userId,
    });
  } catch (err: any) {
    if (err.message === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error('[Auth] Registration error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /auth/login
router.post('/login', loginLimiter, validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const result = await loginUser({
      email: req.body.email,
      password: req.body.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if ('requireMfa' in result && result.requireMfa) {
      return res.json({ requireMfa: true, userId: result.userId });
    }

    const session = result as { accessToken: string; refreshToken: string; userId: string };

    // Set refresh token cookie
    res.cookie('refreshToken', session.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.json({
      accessToken: session.accessToken,
      userId: session.userId,
    });
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (err.message === 'ACCOUNT_LOCKED') {
      return res.status(423).json({ error: 'Account temporarily locked. Please try again in 15 minutes.' });
    }
    if (err.message === 'ACCOUNT_LOCKED_PERMANENT') {
      return res.status(423).json({ error: 'Account locked. Please reset your password or contact support.' });
    }
    if (err.message === 'OAUTH_ONLY_ACCOUNT') {
      return res.status(400).json({ error: 'This account uses Google Sign-In. Please use the "Continue with Google" button.' });
    }
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /auth/mfa/verify
router.post('/mfa/verify', loginLimiter, validateBody(mfaVerifySchema), async (req: Request, res: Response) => {
  try {
    const result = await completeMfaLogin(
      req.body.userId,
      req.body.code,
      req.ip,
      req.headers['user-agent']
    );

    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ accessToken: result.accessToken, userId: result.userId });
  } catch (err: any) {
    if (err.message === 'INVALID_MFA_CODE') {
      return res.status(401).json({ error: 'Invalid MFA code.' });
    }
    console.error('[Auth] MFA verify error:', err);
    res.status(500).json({ error: 'MFA verification failed.' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token', code: 'NO_REFRESH_TOKEN' });
    }

    const result = await refreshSession(refreshToken, req.ip, req.headers['user-agent']);

    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ accessToken: result.accessToken });
  } catch (err: any) {
    if (err.message === 'INVALID_REFRESH_TOKEN') {
      res.clearCookie('refreshToken', { path: '/auth/refresh' });
      return res.status(401).json({ error: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
    }
    console.error('[Auth] Refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed.' });
  }
});

// POST /auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await logout(refreshToken);
    }
    res.clearCookie('refreshToken', { path: '/auth/refresh' });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[Auth] Logout error:', err);
    res.json({ message: 'Logged out' });
  }
});

// POST /auth/logout-all
router.post('/logout-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await logoutAll(req.userId!);
    res.clearCookie('refreshToken', { path: '/auth/refresh' });
    res.json({ message: 'All sessions terminated' });
  } catch (err) {
    console.error('[Auth] Logout all error:', err);
    res.status(500).json({ error: 'Failed to terminate all sessions.' });
  }
});

// POST /auth/verify-email
router.post('/verify-email', validateBody(verifyEmailSchema), async (req: Request, res: Response) => {
  try {
    await verifyEmail(req.body.token);
    res.json({ message: 'Email verified successfully!' });
  } catch (err: any) {
    if (err.message === 'INVALID_OR_EXPIRED_TOKEN') {
      return res.status(400).json({ error: 'Invalid or expired verification link.' });
    }
    console.error('[Auth] Verify email error:', err);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// POST /auth/resend-verification
router.post('/resend-verification', verificationResendLimiter, validateBody(resendVerificationSchema), async (req: Request, res: Response) => {
  try {
    await resendVerification(req.body.email);
    res.json({ message: 'If an account exists with that email, a verification link has been sent.' });
  } catch (err) {
    console.error('[Auth] Resend verification error:', err);
    res.json({ message: 'If an account exists with that email, a verification link has been sent.' });
  }
});

// POST /auth/forgot-password
router.post('/forgot-password', passwordResetLimiter, validateBody(forgotPasswordSchema), async (req: Request, res: Response) => {
  try {
    await requestPasswordReset(req.body.email, req.ip);
    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', passwordResetLimiter, validateBody(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    await resetPassword(req.body.token, req.body.password, req.ip);
    res.json({ message: 'Password reset successfully. Please log in with your new password.' });
  } catch (err: any) {
    if (err.message === 'INVALID_OR_EXPIRED_TOKEN') {
      return res.status(400).json({ error: 'Invalid or expired reset link.' });
    }
    console.error('[Auth] Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed.' });
  }
});

// POST /auth/change-password (authenticated)
router.post('/change-password', authMiddleware, validateBody(changePasswordSchema), async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    await changePassword(req.userId!, req.body.currentPassword, req.body.newPassword, refreshToken);
    res.json({ message: 'Password changed successfully. Other sessions have been logged out.' });
  } catch (err: any) {
    if (err.message === 'INVALID_PASSWORD') {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    console.error('[Auth] Change password error:', err);
    res.status(500).json({ error: 'Password change failed.' });
  }
});

// GET /auth/mfa/setup (authenticated)
router.get('/mfa/setup', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await setupMfa(req.userId!);
    const qrCodeDataUrl = await QRCode.toDataURL(result.otpauthUrl);
    res.json({ qrCode: qrCodeDataUrl, backupCodes: result.backupCodes });
  } catch (err) {
    console.error('[Auth] MFA setup error:', err);
    res.status(500).json({ error: 'MFA setup failed.' });
  }
});

// POST /auth/mfa/confirm (authenticated)
router.post('/mfa/confirm', authMiddleware, validateBody(mfaSetupConfirmSchema), async (req: AuthRequest, res: Response) => {
  try {
    await confirmMfa(req.userId!, req.body.code);
    res.json({ message: 'MFA enabled successfully!' });
  } catch (err: any) {
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
router.post('/mfa/disable', authMiddleware, validateBody(mfaDisableSchema), async (req: AuthRequest, res: Response) => {
  try {
    await disableMfa(req.userId!, req.body.password);
    res.json({ message: 'MFA disabled.' });
  } catch (err: any) {
    if (err.message === 'INVALID_PASSWORD') {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    console.error('[Auth] MFA disable error:', err);
    res.status(500).json({ error: 'Failed to disable MFA.' });
  }
});

// PATCH /auth/profile (authenticated)
router.patch('/profile', authMiddleware, validateBody(updateProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    await updateMeasurementSystem(req.userId!, req.body.measurementSystem);
    res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('[Auth] Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// GET /auth/profile (authenticated)
router.get('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await getUserProfile(req.userId!);
    res.json(profile);
  } catch (err) {
    console.error('[Auth] Profile error:', err);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

// GET /auth/sessions (authenticated)
router.get('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await getActiveSessions(req.userId!);
    res.json(sessions);
  } catch (err) {
    console.error('[Auth] Sessions error:', err);
    res.status(500).json({ error: 'Failed to load sessions.' });
  }
});

// DELETE /auth/sessions/:sessionId (authenticated)
router.delete('/sessions/:sessionId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await revokeSession(req.userId!, req.params.sessionId as string);
    res.json({ message: 'Session revoked.' });
  } catch (err) {
    console.error('[Auth] Revoke session error:', err);
    res.status(500).json({ error: 'Failed to revoke session.' });
  }
});

// GET /auth/export-data (authenticated)
router.get('/export-data', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = await exportUserData(req.userId!);
    res.json(data);
  } catch (err) {
    console.error('[Auth] Export error:', err);
    res.status(500).json({ error: 'Failed to export data.' });
  }
});

// POST /auth/delete-account (authenticated)
router.post('/delete-account', authMiddleware, validateBody(deleteAccountSchema), async (req: AuthRequest, res: Response) => {
  try {
    await deleteAccount(req.userId!, req.body.password);
    res.clearCookie('refreshToken', { path: '/auth/refresh' });
    res.json({ message: 'Account scheduled for deletion. You have 30 days to cancel by logging in.' });
  } catch (err: any) {
    if (err.message === 'INVALID_PASSWORD') {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    if (err.message === 'OAUTH_ONLY_ACCOUNT') {
      return res.status(400).json({ error: 'Cannot change password on an OAuth-only account.' });
    }
    console.error('[Auth] Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

// ─── Google OAuth ───────────────────────────────────────────────────

// GET /auth/google — redirect to Google consent page
router.get('/google', loginLimiter, (_req: Request, res: Response) => {
  try {
    const { url, state } = JSON.parse(getGoogleAuthUrl());

    // Store the state in a short-lived cookie for CSRF verification
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/',
    });

    res.redirect(url);
  } catch (err) {
    console.error('[Auth] Google OAuth URL error:', err);
    res.status(500).json({ error: 'Failed to initiate Google sign-in.' });
  }
});

// GET /auth/google/callback — handle Google's redirect
router.get('/google/callback', async (req: Request, res: Response) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      console.error('[Auth] Google OAuth error:', oauthError);
      return res.redirect(`${FRONTEND_URL}/auth/login?error=google_denied`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=google_no_code`);
    }

    // Verify CSRF state
    const storedState = req.cookies?.oauth_state;
    if (!storedState || storedState !== state) {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=google_csrf`);
    }

    // Clear the state cookie
    res.clearCookie('oauth_state', { path: '/' });

    const result = await handleGoogleCallback(
      code,
      req.ip,
      req.headers['user-agent']
    );

    // Set refresh token cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Redirect to frontend callback page with access token
    const params = new URLSearchParams({
      token: result.accessToken,
      needsProfile: result.needsProfileCompletion ? '1' : '0',
    });

    res.redirect(`${FRONTEND_URL}/auth/callback?${params.toString()}`);
  } catch (err: any) {
    console.error('[Auth] Google callback error:', err);

    if (err.message === 'ACCOUNT_EXISTS_LINK_REQUIRED') {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=account_exists_link_required`);
    }
    if (err.message === 'ACCOUNT_DELETED') {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=account_deleted`);
    }

    res.redirect(`${FRONTEND_URL}/auth/login?error=google_failed`);
  }
});

// POST /auth/complete-profile (authenticated)
router.post('/complete-profile', authMiddleware, validateBody(completeProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    await completeProfile(req.userId!, req.body.dateOfBirth);
    res.json({ message: 'Profile completed successfully.' });
  } catch (err: any) {
    if (err.message === 'AGE_REQUIREMENT') {
      return res.status(400).json({ error: 'You must be at least 13 years old to use NutriBot.' });
    }
    console.error('[Auth] Complete profile error:', err);
    res.status(500).json({ error: 'Failed to complete profile.' });
  }
});

export default router;
