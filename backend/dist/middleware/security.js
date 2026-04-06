"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsMiddleware = exports.helmetMiddleware = void 0;
exports.securityHeaders = securityHeaders;
exports.requestSizeLimit = requestSizeLimit;
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
exports.helmetMiddleware = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"], // Needed for styled-jsx/CSS-in-JS
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", FRONTEND_URL],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});
exports.corsMiddleware = (0, cors_1.default)({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
});
function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    next();
}
function requestSizeLimit(req, res, next) {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > 1048576) { // 1 MB
        return res.status(413).json({ error: 'Request body too large' });
    }
    next();
}
//# sourceMappingURL=security.js.map