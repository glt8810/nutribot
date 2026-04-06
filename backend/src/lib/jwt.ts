import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { importPKCS8, importSPKI, SignJWT, jwtVerify, type JWTPayload } from 'jose';

const KEYS_DIR = path.join(__dirname, '../../keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

let privateKey: crypto.KeyObject | null = null;
let publicKey: crypto.KeyObject | null = null;

export interface TokenPayload extends JWTPayload {
  uid: string;
  role?: string;
}

function ensureKeysExist(): void {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
    console.log('[JWT] Generating RS256 key pair...');
    const { publicKey: pub, privateKey: priv } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    fs.writeFileSync(PRIVATE_KEY_PATH, priv, { mode: 0o600 });
    fs.writeFileSync(PUBLIC_KEY_PATH, pub, { mode: 0o644 });
    console.log('[JWT] Key pair generated and saved');
  }
}

async function getPrivateKey() {
  if (!privateKey) {
    ensureKeysExist();
    const pem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
    privateKey = await importPKCS8(pem, 'RS256') as any;
  }
  return privateKey!;
}

async function getPublicKey() {
  if (!publicKey) {
    ensureKeysExist();
    const pem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');
    publicKey = await importSPKI(pem, 'RS256') as any;
  }
  return publicKey!;
}

export async function signAccessToken(userId: string): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setIssuer(process.env.JWT_ISSUER || 'nutribot')
    .setAudience(process.env.JWT_AUDIENCE || 'nutribot-app')
    .setExpirationTime(process.env.JWT_ACCESS_EXPIRY || '15m')
    .sign(key);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const key = await getPublicKey();
  const { payload } = await jwtVerify(token, key, {
    issuer: process.env.JWT_ISSUER || 'nutribot',
    audience: process.env.JWT_AUDIENCE || 'nutribot-app',
  });
  return payload as TokenPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export { ensureKeysExist };
