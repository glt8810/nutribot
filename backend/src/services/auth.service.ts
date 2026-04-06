import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import prisma from '../lib/prisma';
import { cache } from '../lib/redis';
import { encrypt, decrypt } from './crypto.service';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  generateVerificationToken,
} from '../lib/jwt';
import {
  MAX_FAILED_LOGINS,
  LOCKOUT_DURATION_MINUTES,
  MAX_DAILY_FAILED_LOGINS,
  MAX_SESSIONS_PER_USER,
  VERIFICATION_TOKEN_EXPIRY_HOURS,
  RESET_TOKEN_EXPIRY_HOURS,
  MFA_BACKUP_CODE_COUNT,
  MFA_BACKUP_CODE_LENGTH,
  AUDIT_EVENTS,
  PASSWORD_MIN_LENGTH,
} from '../lib/constants';
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail, sendSessionLimitEmail } from './email.service';
import { OAuth2Client } from 'google-auth-library';

// Google OAuth client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback'
);

// Argon2id parameters — reduced in dev for faster testing
const isDev = process.env.NODE_ENV !== 'production';
const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: isDev ? 8192 : 65536, // 8 MB dev / 64 MB prod
  timeCost: isDev ? 2 : 3,
  parallelism: isDev ? 1 : 4,
  hashLength: 32,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Constant-time dummy hash for timing-attack prevention
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$dummysalt$dummyhashvalue1234567890abcdef';

export async function checkPasswordBreach(password: string): Promise<boolean> {
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.substring(0, 5);
    const suffix = sha1.substring(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });

    if (!response.ok) return false; // Fail open — don't block registration on API failure

    const text = await response.text();
    const lines = text.split('\n');
    for (const line of lines) {
      const [hashSuffix] = line.split(':');
      if (hashSuffix.trim() === suffix) return true;
    }
    return false;
  } catch {
    return false; // Fail open
  }
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string;
  consentVersion: string;
  referralSource?: string;
}

export async function registerUser(input: RegisterInput, ip?: string) {
  const { email, password, fullName, dateOfBirth, consentVersion, referralSource } = input;
  const normalizedEmail = email.toLowerCase().trim();

  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new Error('EMAIL_EXISTS');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Encrypt PII
  const fullNameEnc = encrypt(fullName);
  const dateOfBirthEnc = encrypt(dateOfBirth);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      fullNameEnc,
      dateOfBirthEnc,
      consentVersion,
      consentAt: new Date(),
      referralSource: referralSource || null,
    },
  });

  // Generate verification token
  const token = generateVerificationToken();
  const tokenHash = hashToken(token);

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });

  // Send verification email
  const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email?token=${token}`;
  await sendVerificationEmail(normalizedEmail, fullName, verificationUrl);

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      eventType: AUDIT_EVENTS.REGISTER,
      ipAddress: ip,
      metadata: {},
    },
  });

  return { userId: user.id, email: normalizedEmail };
}

export interface LoginInput {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

export async function loginUser(input: LoginInput) {
  const { email, password, ip, userAgent, deviceFingerprint } = input;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || user.deletedAt) {
    // Timing attack prevention: hash dummy value
    await argon2.verify(DUMMY_HASH, password).catch(() => {});
    throw new Error('INVALID_CREDENTIALS');
  }

  // OAuth-only users cannot log in with password
  if (!user.passwordHash) {
    throw new Error('OAUTH_ONLY_ACCOUNT');
  }

  // Check account lock
  if (user.accountLocked) {
    if (user.lockExpiresAt && user.lockExpiresAt > new Date()) {
      throw new Error('ACCOUNT_LOCKED');
    }
    // Lock expired — reset
    if (user.lockExpiresAt && user.lockExpiresAt <= new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { accountLocked: false, failedLoginCount: 0, lockExpiresAt: null },
      });
    } else if (!user.lockExpiresAt) {
      // Indefinite lock
      throw new Error('ACCOUNT_LOCKED_PERMANENT');
    }
  }

  // Verify password
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    const newCount = user.failedLoginCount + 1;
    let lockData: any = { failedLoginCount: newCount };

    if (newCount >= MAX_DAILY_FAILED_LOGINS) {
      lockData.accountLocked = true;
      lockData.lockExpiresAt = null; // Indefinite lock
    } else if (newCount >= MAX_FAILED_LOGINS) {
      lockData.accountLocked = true;
      lockData.lockExpiresAt = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    }

    await prisma.user.update({ where: { id: user.id }, data: lockData });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        eventType: AUDIT_EVENTS.LOGIN_FAILURE,
        ipAddress: ip,
        userAgent,
        metadata: { failedCount: newCount },
      },
    });

    if (lockData.accountLocked) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          eventType: AUDIT_EVENTS.ACCOUNT_LOCKED,
          ipAddress: ip,
          metadata: { permanent: !lockData.lockExpiresAt },
        },
      });
    }

    throw new Error('INVALID_CREDENTIALS');
  }

  // Check if MFA is enabled
  if (user.mfaEnabled) {
    // Return partial auth — require MFA step
    return { requireMfa: true, userId: user.id };
  }

  // Successful login — create session
  return await createSession(user.id, ip, userAgent, deviceFingerprint);
}

export async function completeMfaLogin(
  userId: string,
  totpCode: string,
  ip?: string,
  userAgent?: string,
  deviceFingerprint?: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaEnabled || !user.mfaSecretEnc) {
    throw new Error('MFA_NOT_CONFIGURED');
  }

  const { authenticator } = await import('otplib');
  const secret = decrypt(user.mfaSecretEnc);

  // Check if it's a backup code
  let isBackupCode = false;
  const backupHashes: string[] = user.mfaBackupHashes ? JSON.parse(user.mfaBackupHashes) : [];
  if (totpCode.length === MFA_BACKUP_CODE_LENGTH) {
    for (let i = 0; i < backupHashes.length; i++) {
      const match = await verifyPassword(backupHashes[i], totpCode);
      if (match) {
        isBackupCode = true;
        // Remove used backup code
        backupHashes.splice(i, 1);
        await prisma.user.update({
          where: { id: userId },
          data: { mfaBackupHashes: JSON.stringify(backupHashes) },
        });
        break;
      }
    }
  }

  if (!isBackupCode) {
    const isValid = authenticator.check(totpCode, secret);
    if (!isValid) {
      throw new Error('INVALID_MFA_CODE');
    }
  }

  return await createSession(userId, ip, userAgent, deviceFingerprint);
}

async function createSession(userId: string, ip?: string, userAgent?: string, deviceFingerprint?: string) {
  // Reset failed login count
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, accountLocked: false, lockExpiresAt: null },
  });

  // Enforce session limit
  const activeSessions = await prisma.session.findMany({
    where: { userId, revoked: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'asc' },
  });

  if (activeSessions.length >= MAX_SESSIONS_PER_USER) {
    // Revoke oldest
    const oldest = activeSessions[0];
    await prisma.session.update({
      where: { id: oldest.id },
      data: { revoked: true },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await sendSessionLimitEmail(user.email, decrypt(user.fullNameEnc));
    }
  }

  // Generate tokens
  const accessToken = await signAccessToken(userId);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);

  // Store session
  await prisma.session.create({
    data: {
      userId,
      refreshTokenHash,
      deviceFingerprint,
      ipAddress: ip,
      userAgent,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      eventType: AUDIT_EVENTS.LOGIN_SUCCESS,
      ipAddress: ip,
      userAgent,
    },
  });

  return { accessToken, refreshToken, userId };
}

export async function refreshSession(refreshToken: string, ip?: string, userAgent?: string) {
  const refreshTokenHash = hashToken(refreshToken);

  const session = await prisma.session.findFirst({
    where: {
      refreshTokenHash,
      revoked: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!session) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  // Revoke old session
  await prisma.session.update({
    where: { id: session.id },
    data: { revoked: true },
  });

  // Create new session
  const accessToken = await signAccessToken(session.userId);
  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashToken(newRefreshToken);

  await prisma.session.create({
    data: {
      userId: session.userId,
      refreshTokenHash: newRefreshTokenHash,
      deviceFingerprint: session.deviceFingerprint,
      ipAddress: ip,
      userAgent,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(refreshToken: string) {
  const refreshTokenHash = hashToken(refreshToken);
  await prisma.session.updateMany({
    where: { refreshTokenHash },
    data: { revoked: true },
  });
}

export async function logoutAll(userId: string) {
  await prisma.session.updateMany({
    where: { userId },
    data: { revoked: true },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      eventType: AUDIT_EVENTS.LOGOUT_ALL,
    },
  });
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);

  const record = await prisma.emailVerificationToken.findFirst({
    where: {
      tokenHash,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    throw new Error('INVALID_OR_EXPIRED_TOKEN');
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { used: true },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      userId: record.userId,
      eventType: AUDIT_EVENTS.EMAIL_VERIFIED,
    },
  });

  return { userId: record.userId };
}

export async function resendVerification(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || user.emailVerified) {
    return; // Don't reveal if user exists
  }

  const token = generateVerificationToken();
  const tokenHash = hashToken(token);

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });

  const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email?token=${token}`;
  await sendVerificationEmail(normalizedEmail, decrypt(user.fullNameEnc), verificationUrl);
}

export async function requestPasswordReset(email: string, ip?: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  await prisma.auditLog.create({
    data: {
      userId: user?.id || null,
      eventType: AUDIT_EVENTS.PASSWORD_RESET_REQUEST,
      ipAddress: ip,
      metadata: { email: normalizedEmail },
    },
  });

  if (!user) return; // Don't reveal if user exists

  const token = generateVerificationToken();
  const tokenHash = hashToken(token);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });

  const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`;
  await sendPasswordResetEmail(normalizedEmail, decrypt(user.fullNameEnc), resetUrl);
}

export async function resetPassword(token: string, newPassword: string, ip?: string) {
  const tokenHash = hashToken(token);

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    throw new Error('INVALID_OR_EXPIRED_TOKEN');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { used: true },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    // Revoke ALL sessions
    prisma.session.updateMany({
      where: { userId: record.userId },
      data: { revoked: true },
    }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (user) {
    await sendPasswordChangedEmail(user.email, decrypt(user.fullNameEnc));
  }

  await prisma.auditLog.create({
    data: {
      userId: record.userId,
      eventType: AUDIT_EVENTS.PASSWORD_RESET_COMPLETE,
      ipAddress: ip,
    },
  });
}

export async function setupMfa(userId: string) {
  const { authenticator } = await import('otplib');
  const secret = authenticator.generateSecret();

  // Generate backup codes
  const backupCodes: string[] = [];
  const backupHashes: string[] = [];
  for (let i = 0; i < MFA_BACKUP_CODE_COUNT; i++) {
    const code = crypto.randomBytes(MFA_BACKUP_CODE_LENGTH / 2 + 1)
      .toString('hex')
      .substring(0, MFA_BACKUP_CODE_LENGTH)
      .toUpperCase();
    backupCodes.push(code);
    backupHashes.push(await hashPassword(code));
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  const otpauthUrl = authenticator.keyuri(user.email, 'NutriBot', secret);

  // Store encrypted secret temporarily (not enabled until verified)
  const secretEnc = encrypt(secret);

  // Store temporarily until user verifies
  await cache.set(`mfa_setup:${userId}`, JSON.stringify({
    secretEnc,
    backupHashes,
    backupCodes, // Only stored temporarily for display
  }), 'EX', 600); // 10 minute expiry

  return { otpauthUrl, backupCodes };
}

export async function confirmMfa(userId: string, totpCode: string) {
  const setupData = await cache.get(`mfa_setup:${userId}`);
  if (!setupData) throw new Error('MFA_SETUP_EXPIRED');

  const { secretEnc, backupHashes } = JSON.parse(setupData);
  const secret = decrypt(secretEnc);

  const { authenticator } = await import('otplib');
  const isValid = authenticator.check(totpCode, secret);
  if (!isValid) throw new Error('INVALID_MFA_CODE');

  // Enable MFA
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: true,
      mfaSecretEnc: secretEnc,
      mfaBackupHashes: JSON.stringify(backupHashes),
    },
  });

  await cache.del(`mfa_setup:${userId}`);

  await prisma.auditLog.create({
    data: {
      userId,
      eventType: AUDIT_EVENTS.MFA_ENABLE,
    },
  });
}

export async function disableMfa(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  if (!user.passwordHash) throw new Error('OAUTH_ONLY_ACCOUNT');
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) throw new Error('INVALID_PASSWORD');

  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: false,
      mfaSecretEnc: null,
      mfaBackupHashes: '[]',
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      eventType: AUDIT_EVENTS.MFA_DISABLE,
    },
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string, currentRefreshToken?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  if (!user.passwordHash) throw new Error('OAUTH_ONLY_ACCOUNT');
  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) throw new Error('INVALID_PASSWORD');

  const newPasswordHash = await hashPassword(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });

  // Revoke all sessions except current
  if (currentRefreshToken) {
    const currentHash = hashToken(currentRefreshToken);
    await prisma.session.updateMany({
      where: {
        userId,
        refreshTokenHash: { not: currentHash },
      },
      data: { revoked: true },
    });
  } else {
    await prisma.session.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  }

  await sendPasswordChangedEmail(user.email, decrypt(user.fullNameEnc));

  await prisma.auditLog.create({
    data: {
      userId,
      eventType: AUDIT_EVENTS.PASSWORD_CHANGE,
    },
  });
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      fullNameEnc: true,
      dateOfBirthEnc: true,
      avatarUrl: true,
      passwordHash: true,
      mfaEnabled: true,
      createdAt: true,
      oauthAccounts: {
        select: { provider: true },
      },
    },
  });

  if (!user) throw new Error('USER_NOT_FOUND');

  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    fullName: decrypt(user.fullNameEnc),
    dateOfBirth: user.dateOfBirthEnc ? decrypt(user.dateOfBirthEnc) : null,
    avatarUrl: user.avatarUrl,
    hasPassword: !!user.passwordHash,
    mfaEnabled: user.mfaEnabled,
    oauthProviders: user.oauthAccounts.map((oa) => oa.provider),
    needsProfileCompletion: !user.dateOfBirthEnc,
    createdAt: user.createdAt,
  };
}

export async function deleteAccount(userId: string, password?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  // If user has a password, they must verify it
  if (user.passwordHash) {
    if (!password) throw new Error('INVALID_PASSWORD');
    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) throw new Error('INVALID_PASSWORD');
  }
  // OAuth-only users can delete without a password (they're already authenticated)

  // Soft delete
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });

  // Revoke all sessions
  await prisma.session.updateMany({
    where: { userId },
    data: { revoked: true },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      eventType: AUDIT_EVENTS.ACCOUNT_DELETED,
    },
  });
}

export async function getActiveSessions(userId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, revoked: false, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return sessions;
}

export async function revokeSession(userId: string, sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, userId },
    data: { revoked: true },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      eventType: AUDIT_EVENTS.SESSION_REVOKED,
      metadata: { sessionId },
    },
  });
}

export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      goals: {
        include: {
          intakeResponses: true,
          nutritionPlans: {
            include: {
              modules: {
                include: {
                  mealFeedback: true,
                },
              },
            },
          },
        },
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 1000,
      },
    },
  });

  if (!user) throw new Error('USER_NOT_FOUND');

  // Decrypt PII for export
  const exportData = {
    profile: {
      email: user.email,
      fullName: decrypt(user.fullNameEnc),
      dateOfBirth: user.dateOfBirthEnc ? decrypt(user.dateOfBirthEnc) : null,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
    },
    goals: user.goals.map((g: any) => ({
      ...g,
      intakeResponses: g.intakeResponses.map((r: any) => ({
        ...r,
        responses: JSON.parse(decrypt(r.responsesEnc)),
      })),
    })),
    auditLog: user.auditLogs,
  };

  await prisma.auditLog.create({
    data: {
      userId,
      eventType: AUDIT_EVENTS.DATA_EXPORT,
    },
  });

  return exportData;
}

// ─── Google OAuth ──────────────────────────────────────────────────────────

export function getGoogleAuthUrl(): string {
  // Generate CSRF state token
  const state = crypto.randomBytes(32).toString('hex');

  const url = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state,
    prompt: 'consent',
  });

  return JSON.stringify({ url, state });
}

export interface GoogleCallbackResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
  isNewUser: boolean;
  needsProfileCompletion: boolean;
}

export async function handleGoogleCallback(
  code: string,
  ip?: string,
  userAgent?: string
): Promise<GoogleCallbackResult> {
  // Exchange authorization code for tokens
  const { tokens } = await googleClient.getToken(code);

  if (!tokens.id_token) {
    throw new Error('GOOGLE_NO_ID_TOKEN');
  }

  // Verify the ID token
  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error('GOOGLE_INVALID_TOKEN');
  }

  const googleId = payload.sub;
  const email = payload.email.toLowerCase().trim();
  const emailVerified = payload.email_verified || false;
  const fullName = payload.name || email.split('@')[0];
  const avatarUrl = payload.picture || null;

  // Check if we already have an OAuthAccount for this Google ID
  const existingOAuth = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider: 'google', providerId: googleId } },
    include: { user: true },
  });

  if (existingOAuth) {
    // Existing OAuth user — just create a session
    const user = existingOAuth.user;
    if (user.deletedAt) {
      throw new Error('ACCOUNT_DELETED');
    }

    // Update avatar if changed
    if (avatarUrl && avatarUrl !== user.avatarUrl) {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        eventType: AUDIT_EVENTS.OAUTH_LOGIN,
        ipAddress: ip,
        userAgent,
        metadata: { provider: 'google' },
      },
    });

    const session = await createSession(user.id, ip, userAgent);
    return {
      ...session,
      isNewUser: false,
      needsProfileCompletion: !user.dateOfBirthEnc,
    };
  }

  // No existing OAuth link — check if a user with this email exists
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    // Account exists with this email — apply linking rules
    if (existingUser.deletedAt) {
      throw new Error('ACCOUNT_DELETED');
    }

    // Safe to auto-link only if BOTH sides have verified email
    if (emailVerified && existingUser.emailVerified) {
      // Link the Google account to the existing user
      await prisma.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: 'google',
          providerId: googleId,
        },
      });

      // Update avatar if not set
      if (avatarUrl && !existingUser.avatarUrl) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { avatarUrl },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: existingUser.id,
          eventType: AUDIT_EVENTS.OAUTH_LINK,
          ipAddress: ip,
          metadata: { provider: 'google', autoLinked: true },
        },
      });

      const session = await createSession(existingUser.id, ip, userAgent);
      return {
        ...session,
        isNewUser: false,
        needsProfileCompletion: !existingUser.dateOfBirthEnc,
      };
    }

    // Not safe to auto-link — user must log in with password first
    throw new Error('ACCOUNT_EXISTS_LINK_REQUIRED');
  }

  // No existing user — create a new account
  const fullNameEnc = encrypt(fullName);

  const newUser = await prisma.user.create({
    data: {
      email,
      emailVerified: emailVerified,
      passwordHash: null,
      fullNameEnc,
      dateOfBirthEnc: null, // Will be completed in onboarding
      avatarUrl,
    },
  });

  // Create the OAuth link
  await prisma.oAuthAccount.create({
    data: {
      userId: newUser.id,
      provider: 'google',
      providerId: googleId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: newUser.id,
      eventType: AUDIT_EVENTS.REGISTER,
      ipAddress: ip,
      metadata: { provider: 'google' },
    },
  });

  const session = await createSession(newUser.id, ip, userAgent);
  return {
    ...session,
    isNewUser: true,
    needsProfileCompletion: true,
  };
}

export async function completeProfile(userId: string, dateOfBirth: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  // Validate age
  const dob = new Date(dateOfBirth);
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())
    ? age - 1
    : age;

  if (actualAge < 13) {
    throw new Error('AGE_REQUIREMENT');
  }

  const dateOfBirthEnc = encrypt(dateOfBirth);

  await prisma.user.update({
    where: { id: userId },
    data: { dateOfBirthEnc },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      eventType: AUDIT_EVENTS.PROFILE_COMPLETE,
      metadata: { field: 'dateOfBirth' },
    },
  });
}
