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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.checkPasswordBreach = checkPasswordBreach;
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.completeMfaLogin = completeMfaLogin;
exports.refreshSession = refreshSession;
exports.logout = logout;
exports.logoutAll = logoutAll;
exports.verifyEmail = verifyEmail;
exports.resendVerification = resendVerification;
exports.requestPasswordReset = requestPasswordReset;
exports.resetPassword = resetPassword;
exports.setupMfa = setupMfa;
exports.confirmMfa = confirmMfa;
exports.disableMfa = disableMfa;
exports.changePassword = changePassword;
exports.getUserProfile = getUserProfile;
exports.deleteAccount = deleteAccount;
exports.getActiveSessions = getActiveSessions;
exports.revokeSession = revokeSession;
exports.exportUserData = exportUserData;
const argon2 = __importStar(require("argon2"));
const crypto = __importStar(require("crypto"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const redis_1 = require("../lib/redis");
const crypto_service_1 = require("./crypto.service");
const jwt_1 = require("../lib/jwt");
const constants_1 = require("../lib/constants");
const email_service_1 = require("./email.service");
// Argon2id parameters — reduced in dev for faster testing
const isDev = process.env.NODE_ENV !== 'production';
const ARGON2_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: isDev ? 8192 : 65536, // 8 MB dev / 64 MB prod
    timeCost: isDev ? 2 : 3,
    parallelism: isDev ? 1 : 4,
    hashLength: 32,
};
async function hashPassword(password) {
    return argon2.hash(password, ARGON2_OPTIONS);
}
async function verifyPassword(hash, password) {
    try {
        return await argon2.verify(hash, password);
    }
    catch {
        return false;
    }
}
// Constant-time dummy hash for timing-attack prevention
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$dummysalt$dummyhashvalue1234567890abcdef';
async function checkPasswordBreach(password) {
    try {
        const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
        const prefix = sha1.substring(0, 5);
        const suffix = sha1.substring(5);
        const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
            headers: { 'Add-Padding': 'true' },
        });
        if (!response.ok)
            return false; // Fail open — don't block registration on API failure
        const text = await response.text();
        const lines = text.split('\n');
        for (const line of lines) {
            const [hashSuffix] = line.split(':');
            if (hashSuffix.trim() === suffix)
                return true;
        }
        return false;
    }
    catch {
        return false; // Fail open
    }
}
async function registerUser(input, ip) {
    const { email, password, fullName, dateOfBirth, consentVersion, referralSource } = input;
    const normalizedEmail = email.toLowerCase().trim();
    // Check email uniqueness
    const existing = await prisma_1.default.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
        throw new Error('EMAIL_EXISTS');
    }
    // Hash password
    const passwordHash = await hashPassword(password);
    // Encrypt PII
    const fullNameEnc = (0, crypto_service_1.encrypt)(fullName);
    const dateOfBirthEnc = (0, crypto_service_1.encrypt)(dateOfBirth);
    // Create user
    const user = await prisma_1.default.user.create({
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
    const token = (0, jwt_1.generateVerificationToken)();
    const tokenHash = (0, jwt_1.hashToken)(token);
    await prisma_1.default.emailVerificationToken.create({
        data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + constants_1.VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
        },
    });
    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email?token=${token}`;
    await (0, email_service_1.sendVerificationEmail)(normalizedEmail, fullName, verificationUrl);
    // Audit log
    await prisma_1.default.auditLog.create({
        data: {
            userId: user.id,
            eventType: constants_1.AUDIT_EVENTS.REGISTER,
            ipAddress: ip,
            metadata: {},
        },
    });
    return { userId: user.id, email: normalizedEmail };
}
async function loginUser(input) {
    const { email, password, ip, userAgent, deviceFingerprint } = input;
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma_1.default.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.deletedAt) {
        // Timing attack prevention: hash dummy value
        await argon2.verify(DUMMY_HASH, password).catch(() => { });
        throw new Error('INVALID_CREDENTIALS');
    }
    // Check account lock
    if (user.accountLocked) {
        if (user.lockExpiresAt && user.lockExpiresAt > new Date()) {
            throw new Error('ACCOUNT_LOCKED');
        }
        // Lock expired — reset
        if (user.lockExpiresAt && user.lockExpiresAt <= new Date()) {
            await prisma_1.default.user.update({
                where: { id: user.id },
                data: { accountLocked: false, failedLoginCount: 0, lockExpiresAt: null },
            });
        }
        else if (!user.lockExpiresAt) {
            // Indefinite lock
            throw new Error('ACCOUNT_LOCKED_PERMANENT');
        }
    }
    // Verify password
    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
        const newCount = user.failedLoginCount + 1;
        let lockData = { failedLoginCount: newCount };
        if (newCount >= constants_1.MAX_DAILY_FAILED_LOGINS) {
            lockData.accountLocked = true;
            lockData.lockExpiresAt = null; // Indefinite lock
        }
        else if (newCount >= constants_1.MAX_FAILED_LOGINS) {
            lockData.accountLocked = true;
            lockData.lockExpiresAt = new Date(Date.now() + constants_1.LOCKOUT_DURATION_MINUTES * 60 * 1000);
        }
        await prisma_1.default.user.update({ where: { id: user.id }, data: lockData });
        await prisma_1.default.auditLog.create({
            data: {
                userId: user.id,
                eventType: constants_1.AUDIT_EVENTS.LOGIN_FAILURE,
                ipAddress: ip,
                userAgent,
                metadata: { failedCount: newCount },
            },
        });
        if (lockData.accountLocked) {
            await prisma_1.default.auditLog.create({
                data: {
                    userId: user.id,
                    eventType: constants_1.AUDIT_EVENTS.ACCOUNT_LOCKED,
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
async function completeMfaLogin(userId, totpCode, ip, userAgent, deviceFingerprint) {
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecretEnc) {
        throw new Error('MFA_NOT_CONFIGURED');
    }
    const { authenticator } = await Promise.resolve().then(() => __importStar(require('otplib')));
    const secret = (0, crypto_service_1.decrypt)(user.mfaSecretEnc);
    // Check if it's a backup code
    let isBackupCode = false;
    const backupHashes = user.mfaBackupHashes ? JSON.parse(user.mfaBackupHashes) : [];
    if (totpCode.length === constants_1.MFA_BACKUP_CODE_LENGTH) {
        for (let i = 0; i < backupHashes.length; i++) {
            const match = await verifyPassword(backupHashes[i], totpCode);
            if (match) {
                isBackupCode = true;
                // Remove used backup code
                backupHashes.splice(i, 1);
                await prisma_1.default.user.update({
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
async function createSession(userId, ip, userAgent, deviceFingerprint) {
    // Reset failed login count
    await prisma_1.default.user.update({
        where: { id: userId },
        data: { failedLoginCount: 0, accountLocked: false, lockExpiresAt: null },
    });
    // Enforce session limit
    const activeSessions = await prisma_1.default.session.findMany({
        where: { userId, revoked: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'asc' },
    });
    if (activeSessions.length >= constants_1.MAX_SESSIONS_PER_USER) {
        // Revoke oldest
        const oldest = activeSessions[0];
        await prisma_1.default.session.update({
            where: { id: oldest.id },
            data: { revoked: true },
        });
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (user) {
            await (0, email_service_1.sendSessionLimitEmail)(user.email, (0, crypto_service_1.decrypt)(user.fullNameEnc));
        }
    }
    // Generate tokens
    const accessToken = await (0, jwt_1.signAccessToken)(userId);
    const refreshToken = (0, jwt_1.generateRefreshToken)();
    const refreshTokenHash = (0, jwt_1.hashToken)(refreshToken);
    // Store session
    await prisma_1.default.session.create({
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
    await prisma_1.default.auditLog.create({
        data: {
            userId,
            eventType: constants_1.AUDIT_EVENTS.LOGIN_SUCCESS,
            ipAddress: ip,
            userAgent,
        },
    });
    return { accessToken, refreshToken, userId };
}
async function refreshSession(refreshToken, ip, userAgent) {
    const refreshTokenHash = (0, jwt_1.hashToken)(refreshToken);
    const session = await prisma_1.default.session.findFirst({
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
    await prisma_1.default.session.update({
        where: { id: session.id },
        data: { revoked: true },
    });
    // Create new session
    const accessToken = await (0, jwt_1.signAccessToken)(session.userId);
    const newRefreshToken = (0, jwt_1.generateRefreshToken)();
    const newRefreshTokenHash = (0, jwt_1.hashToken)(newRefreshToken);
    await prisma_1.default.session.create({
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
async function logout(refreshToken) {
    const refreshTokenHash = (0, jwt_1.hashToken)(refreshToken);
    await prisma_1.default.session.updateMany({
        where: { refreshTokenHash },
        data: { revoked: true },
    });
}
async function logoutAll(userId) {
    await prisma_1.default.session.updateMany({
        where: { userId },
        data: { revoked: true },
    });
    await prisma_1.default.auditLog.create({
        data: {
            userId,
            eventType: constants_1.AUDIT_EVENTS.LOGOUT_ALL,
        },
    });
}
async function verifyEmail(token) {
    const tokenHash = (0, jwt_1.hashToken)(token);
    const record = await prisma_1.default.emailVerificationToken.findFirst({
        where: {
            tokenHash,
            used: false,
            expiresAt: { gt: new Date() },
        },
    });
    if (!record) {
        throw new Error('INVALID_OR_EXPIRED_TOKEN');
    }
    await prisma_1.default.$transaction([
        prisma_1.default.emailVerificationToken.update({
            where: { id: record.id },
            data: { used: true },
        }),
        prisma_1.default.user.update({
            where: { id: record.userId },
            data: { emailVerified: true },
        }),
    ]);
    await prisma_1.default.auditLog.create({
        data: {
            userId: record.userId,
            eventType: constants_1.AUDIT_EVENTS.EMAIL_VERIFIED,
        },
    });
    return { userId: record.userId };
}
async function resendVerification(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma_1.default.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.emailVerified) {
        return; // Don't reveal if user exists
    }
    const token = (0, jwt_1.generateVerificationToken)();
    const tokenHash = (0, jwt_1.hashToken)(token);
    await prisma_1.default.emailVerificationToken.create({
        data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + constants_1.VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
        },
    });
    const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email?token=${token}`;
    await (0, email_service_1.sendVerificationEmail)(normalizedEmail, (0, crypto_service_1.decrypt)(user.fullNameEnc), verificationUrl);
}
async function requestPasswordReset(email, ip) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma_1.default.user.findUnique({ where: { email: normalizedEmail } });
    await prisma_1.default.auditLog.create({
        data: {
            userId: user?.id || null,
            eventType: constants_1.AUDIT_EVENTS.PASSWORD_RESET_REQUEST,
            ipAddress: ip,
            metadata: { email: normalizedEmail },
        },
    });
    if (!user)
        return; // Don't reveal if user exists
    const token = (0, jwt_1.generateVerificationToken)();
    const tokenHash = (0, jwt_1.hashToken)(token);
    await prisma_1.default.passwordResetToken.create({
        data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + constants_1.RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
        },
    });
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`;
    await (0, email_service_1.sendPasswordResetEmail)(normalizedEmail, (0, crypto_service_1.decrypt)(user.fullNameEnc), resetUrl);
}
async function resetPassword(token, newPassword, ip) {
    const tokenHash = (0, jwt_1.hashToken)(token);
    const record = await prisma_1.default.passwordResetToken.findFirst({
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
    await prisma_1.default.$transaction([
        prisma_1.default.passwordResetToken.update({
            where: { id: record.id },
            data: { used: true },
        }),
        prisma_1.default.user.update({
            where: { id: record.userId },
            data: { passwordHash },
        }),
        // Revoke ALL sessions
        prisma_1.default.session.updateMany({
            where: { userId: record.userId },
            data: { revoked: true },
        }),
    ]);
    const user = await prisma_1.default.user.findUnique({ where: { id: record.userId } });
    if (user) {
        await (0, email_service_1.sendPasswordChangedEmail)(user.email, (0, crypto_service_1.decrypt)(user.fullNameEnc));
    }
    await prisma_1.default.auditLog.create({
        data: {
            userId: record.userId,
            eventType: constants_1.AUDIT_EVENTS.PASSWORD_RESET_COMPLETE,
            ipAddress: ip,
        },
    });
}
async function setupMfa(userId) {
    const { authenticator } = await Promise.resolve().then(() => __importStar(require('otplib')));
    const secret = authenticator.generateSecret();
    // Generate backup codes
    const backupCodes = [];
    const backupHashes = [];
    for (let i = 0; i < constants_1.MFA_BACKUP_CODE_COUNT; i++) {
        const code = crypto.randomBytes(constants_1.MFA_BACKUP_CODE_LENGTH / 2 + 1)
            .toString('hex')
            .substring(0, constants_1.MFA_BACKUP_CODE_LENGTH)
            .toUpperCase();
        backupCodes.push(code);
        backupHashes.push(await hashPassword(code));
    }
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new Error('USER_NOT_FOUND');
    const otpauthUrl = authenticator.keyuri(user.email, 'NutriBot', secret);
    // Store encrypted secret temporarily (not enabled until verified)
    const secretEnc = (0, crypto_service_1.encrypt)(secret);
    // Store temporarily until user verifies
    await redis_1.cache.set(`mfa_setup:${userId}`, JSON.stringify({
        secretEnc,
        backupHashes,
        backupCodes, // Only stored temporarily for display
    }), 'EX', 600); // 10 minute expiry
    return { otpauthUrl, backupCodes };
}
async function confirmMfa(userId, totpCode) {
    const setupData = await redis_1.cache.get(`mfa_setup:${userId}`);
    if (!setupData)
        throw new Error('MFA_SETUP_EXPIRED');
    const { secretEnc, backupHashes } = JSON.parse(setupData);
    const secret = (0, crypto_service_1.decrypt)(secretEnc);
    const { authenticator } = await Promise.resolve().then(() => __importStar(require('otplib')));
    const isValid = authenticator.check(totpCode, secret);
    if (!isValid)
        throw new Error('INVALID_MFA_CODE');
    // Enable MFA
    await prisma_1.default.user.update({
        where: { id: userId },
        data: {
            mfaEnabled: true,
            mfaSecretEnc: secretEnc,
            mfaBackupHashes: JSON.stringify(backupHashes),
        },
    });
    await redis_1.cache.del(`mfa_setup:${userId}`);
    await prisma_1.default.auditLog.create({
        data: {
            userId,
            eventType: constants_1.AUDIT_EVENTS.MFA_ENABLE,
        },
    });
}
async function disableMfa(userId, password) {
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new Error('USER_NOT_FOUND');
    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid)
        throw new Error('INVALID_PASSWORD');
    await prisma_1.default.user.update({
        where: { id: userId },
        data: {
            mfaEnabled: false,
            mfaSecretEnc: null,
            mfaBackupHashes: '[]',
        },
    });
    await prisma_1.default.auditLog.create({
        data: {
            userId,
            eventType: constants_1.AUDIT_EVENTS.MFA_DISABLE,
        },
    });
}
async function changePassword(userId, currentPassword, newPassword, currentRefreshToken) {
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new Error('USER_NOT_FOUND');
    const valid = await verifyPassword(user.passwordHash, currentPassword);
    if (!valid)
        throw new Error('INVALID_PASSWORD');
    const newPasswordHash = await hashPassword(newPassword);
    // Update password
    await prisma_1.default.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
    });
    // Revoke all sessions except current
    if (currentRefreshToken) {
        const currentHash = (0, jwt_1.hashToken)(currentRefreshToken);
        await prisma_1.default.session.updateMany({
            where: {
                userId,
                refreshTokenHash: { not: currentHash },
            },
            data: { revoked: true },
        });
    }
    else {
        await prisma_1.default.session.updateMany({
            where: { userId },
            data: { revoked: true },
        });
    }
    await (0, email_service_1.sendPasswordChangedEmail)(user.email, (0, crypto_service_1.decrypt)(user.fullNameEnc));
    await prisma_1.default.auditLog.create({
        data: {
            userId,
            eventType: constants_1.AUDIT_EVENTS.PASSWORD_CHANGE,
        },
    });
}
async function getUserProfile(userId) {
    const user = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            emailVerified: true,
            fullNameEnc: true,
            dateOfBirthEnc: true,
            mfaEnabled: true,
            createdAt: true,
        },
    });
    if (!user)
        throw new Error('USER_NOT_FOUND');
    return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        fullName: (0, crypto_service_1.decrypt)(user.fullNameEnc),
        dateOfBirth: (0, crypto_service_1.decrypt)(user.dateOfBirthEnc),
        mfaEnabled: user.mfaEnabled,
        createdAt: user.createdAt,
    };
}
async function deleteAccount(userId, password) {
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new Error('USER_NOT_FOUND');
    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid)
        throw new Error('INVALID_PASSWORD');
    // Soft delete
    await prisma_1.default.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
    });
    // Revoke all sessions
    await prisma_1.default.session.updateMany({
        where: { userId },
        data: { revoked: true },
    });
    await prisma_1.default.auditLog.create({
        data: {
            userId,
            eventType: constants_1.AUDIT_EVENTS.ACCOUNT_DELETED,
        },
    });
}
async function getActiveSessions(userId) {
    const sessions = await prisma_1.default.session.findMany({
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
async function revokeSession(userId, sessionId) {
    await prisma_1.default.session.updateMany({
        where: { id: sessionId, userId },
        data: { revoked: true },
    });
    await prisma_1.default.auditLog.create({
        data: {
            userId,
            eventType: constants_1.AUDIT_EVENTS.SESSION_REVOKED,
            metadata: { sessionId },
        },
    });
}
async function exportUserData(userId) {
    const user = await prisma_1.default.user.findUnique({
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
    if (!user)
        throw new Error('USER_NOT_FOUND');
    // Decrypt PII for export
    const exportData = {
        profile: {
            email: user.email,
            fullName: (0, crypto_service_1.decrypt)(user.fullNameEnc),
            dateOfBirth: (0, crypto_service_1.decrypt)(user.dateOfBirthEnc),
            emailVerified: user.emailVerified,
            mfaEnabled: user.mfaEnabled,
            createdAt: user.createdAt,
        },
        goals: user.goals.map((g) => ({
            ...g,
            intakeResponses: g.intakeResponses.map((r) => ({
                ...r,
                responses: JSON.parse((0, crypto_service_1.decrypt)(r.responsesEnc)),
            })),
        })),
        auditLog: user.auditLogs,
    };
    await prisma_1.default.auditLog.create({
        data: {
            userId,
            eventType: constants_1.AUDIT_EVENTS.DATA_EXPORT,
        },
    });
    return exportData;
}
//# sourceMappingURL=auth.service.js.map