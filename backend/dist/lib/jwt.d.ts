import { type JWTPayload } from 'jose';
export interface TokenPayload extends JWTPayload {
    uid: string;
    role?: string;
}
declare function ensureKeysExist(): void;
export declare function signAccessToken(userId: string): Promise<string>;
export declare function verifyAccessToken(token: string): Promise<TokenPayload>;
export declare function generateRefreshToken(): string;
export declare function hashToken(token: string): string;
export declare function generateVerificationToken(): string;
export { ensureKeysExist };
//# sourceMappingURL=jwt.d.ts.map