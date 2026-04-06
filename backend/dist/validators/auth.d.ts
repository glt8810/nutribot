import { z } from 'zod';
export declare const passwordSchema: z.ZodString;
export declare const registerSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodString;
    fullName: z.ZodString;
    dateOfBirth: z.ZodString;
    consentVersion: z.ZodString;
    referralSource: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    dateOfBirth: string;
    consentVersion: string;
    referralSource?: string | undefined;
}, {
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    dateOfBirth: string;
    consentVersion: string;
    referralSource?: string | undefined;
}>, {
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    dateOfBirth: string;
    consentVersion: string;
    referralSource?: string | undefined;
}, {
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    dateOfBirth: string;
    consentVersion: string;
    referralSource?: string | undefined;
}>, {
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    dateOfBirth: string;
    consentVersion: string;
    referralSource?: string | undefined;
}, {
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    dateOfBirth: string;
    consentVersion: string;
    referralSource?: string | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const mfaVerifySchema: z.ZodObject<{
    userId: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    userId: string;
}, {
    code: string;
    userId: string;
}>;
export declare const verifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export declare const resendVerificationSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const resetPasswordSchema: z.ZodEffects<z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    confirmPassword: string;
    token: string;
}, {
    password: string;
    confirmPassword: string;
    token: string;
}>, {
    password: string;
    confirmPassword: string;
    token: string;
}, {
    password: string;
    confirmPassword: string;
    token: string;
}>;
export declare const changePasswordSchema: z.ZodEffects<z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
    confirmNewPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}>, {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}>;
export declare const mfaSetupConfirmSchema: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export declare const mfaDisableSchema: z.ZodObject<{
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
}, {
    password: string;
}>;
export declare const deleteAccountSchema: z.ZodObject<{
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
}, {
    password: string;
}>;
//# sourceMappingURL=auth.d.ts.map