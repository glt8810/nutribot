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
exports.signAccessToken = signAccessToken;
exports.verifyAccessToken = verifyAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.hashToken = hashToken;
exports.generateVerificationToken = generateVerificationToken;
exports.ensureKeysExist = ensureKeysExist;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const jose_1 = require("jose");
const KEYS_DIR = path.join(__dirname, '../../keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');
let privateKey = null;
let publicKey = null;
function ensureKeysExist() {
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
        privateKey = await (0, jose_1.importPKCS8)(pem, 'RS256');
    }
    return privateKey;
}
async function getPublicKey() {
    if (!publicKey) {
        ensureKeysExist();
        const pem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');
        publicKey = await (0, jose_1.importSPKI)(pem, 'RS256');
    }
    return publicKey;
}
async function signAccessToken(userId) {
    const key = await getPrivateKey();
    return new jose_1.SignJWT({ uid: userId })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .setIssuer(process.env.JWT_ISSUER || 'nutribot')
        .setAudience(process.env.JWT_AUDIENCE || 'nutribot-app')
        .setExpirationTime(process.env.JWT_ACCESS_EXPIRY || '15m')
        .sign(key);
}
async function verifyAccessToken(token) {
    const key = await getPublicKey();
    const { payload } = await (0, jose_1.jwtVerify)(token, key, {
        issuer: process.env.JWT_ISSUER || 'nutribot',
        audience: process.env.JWT_AUDIENCE || 'nutribot-app',
    });
    return payload;
}
function generateRefreshToken() {
    return crypto.randomBytes(48).toString('base64url');
}
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
function generateVerificationToken() {
    return crypto.randomBytes(32).toString('base64url');
}
//# sourceMappingURL=jwt.js.map