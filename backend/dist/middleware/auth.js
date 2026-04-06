"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jwt_1 = require("../lib/jwt");
async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const token = authHeader.substring(7);
        const payload = await (0, jwt_1.verifyAccessToken)(token);
        if (!payload.uid) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        req.userId = payload.uid;
        next();
    }
    catch (err) {
        if (err.code === 'ERR_JWT_EXPIRED') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}
//# sourceMappingURL=auth.js.map