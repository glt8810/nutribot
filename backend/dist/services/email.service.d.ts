/**
 * Email Service
 * Currently uses console logging for development.
 * Swap EMAIL_PROVIDER env var to 'sendgrid' and provide SENDGRID_API_KEY for prod.
 */
export declare function sendVerificationEmail(to: string, name: string, verificationUrl: string): Promise<void>;
export declare function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void>;
export declare function sendPasswordChangedEmail(to: string, name: string): Promise<void>;
export declare function sendSessionLimitEmail(to: string, name: string): Promise<void>;
//# sourceMappingURL=email.service.d.ts.map