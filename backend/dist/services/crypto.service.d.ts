/**
 * Encrypt a string using AES-256-GCM.
 * Returns: base64(iv + authTag + ciphertext)
 */
export declare function encrypt(plaintext: string): string;
/**
 * Decrypt a base64 string that was encrypted with encrypt().
 */
export declare function decrypt(encryptedBase64: string): string;
/**
 * Encrypt a JSON object (for intake responses, etc.)
 */
export declare function encryptJSON(data: any): string;
/**
 * Decrypt and parse a JSON object
 */
export declare function decryptJSON<T = any>(encryptedBase64: string): T;
//# sourceMappingURL=crypto.service.d.ts.map