export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(hash: string, password: string): Promise<boolean>;
export declare function checkPasswordBreach(password: string): Promise<boolean>;
export interface RegisterInput {
    email: string;
    password: string;
    fullName: string;
    dateOfBirth: string;
    consentVersion: string;
    referralSource?: string;
}
export declare function registerUser(input: RegisterInput, ip?: string): Promise<{
    userId: string;
    email: string;
}>;
export interface LoginInput {
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
    deviceFingerprint?: string;
}
export declare function loginUser(input: LoginInput): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
} | {
    requireMfa: boolean;
    userId: string;
}>;
export declare function completeMfaLogin(userId: string, totpCode: string, ip?: string, userAgent?: string, deviceFingerprint?: string): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
}>;
export declare function refreshSession(refreshToken: string, ip?: string, userAgent?: string): Promise<{
    accessToken: string;
    refreshToken: string;
}>;
export declare function logout(refreshToken: string): Promise<void>;
export declare function logoutAll(userId: string): Promise<void>;
export declare function verifyEmail(token: string): Promise<{
    userId: string;
}>;
export declare function resendVerification(email: string): Promise<void>;
export declare function requestPasswordReset(email: string, ip?: string): Promise<void>;
export declare function resetPassword(token: string, newPassword: string, ip?: string): Promise<void>;
export declare function setupMfa(userId: string): Promise<{
    otpauthUrl: string;
    backupCodes: string[];
}>;
export declare function confirmMfa(userId: string, totpCode: string): Promise<void>;
export declare function disableMfa(userId: string, password: string): Promise<void>;
export declare function changePassword(userId: string, currentPassword: string, newPassword: string, currentRefreshToken?: string): Promise<void>;
export declare function getUserProfile(userId: string): Promise<{
    id: string;
    email: string;
    emailVerified: boolean;
    fullName: string;
    dateOfBirth: string;
    mfaEnabled: boolean;
    createdAt: Date;
}>;
export declare function deleteAccount(userId: string, password: string): Promise<void>;
export declare function getActiveSessions(userId: string): Promise<{
    id: string;
    createdAt: Date;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
}[]>;
export declare function revokeSession(userId: string, sessionId: string): Promise<void>;
export declare function exportUserData(userId: string): Promise<{
    profile: {
        email: string;
        fullName: string;
        dateOfBirth: string;
        emailVerified: boolean;
        mfaEnabled: boolean;
        createdAt: Date;
    };
    goals: any[];
    auditLog: {
        userId: string | null;
        id: string;
        createdAt: Date;
        eventType: string;
        ipAddress: string | null;
        userAgent: string | null;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
    }[];
}>;
//# sourceMappingURL=auth.service.d.ts.map