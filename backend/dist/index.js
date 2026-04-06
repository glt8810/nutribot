"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const security_1 = require("./middleware/security");
const auth_1 = __importDefault(require("./routes/auth"));
const goals_1 = __importDefault(require("./routes/goals"));
const plans_1 = __importDefault(require("./routes/plans"));
const redis_1 = require("./lib/redis");
const jwt_1 = require("./lib/jwt");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Security middleware
app.use(security_1.helmetMiddleware);
app.use(security_1.corsMiddleware);
app.use(security_1.securityHeaders);
// Body parsing
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: false, limit: '1mb' }));
app.use((0, cookie_parser_1.default)());
app.use(security_1.requestSizeLimit);
// Trust proxy for rate limiting
app.set('trust proxy', 1);
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Routes
app.use('/auth', auth_1.default);
app.use('/goals', goals_1.default);
app.use('/plans', plans_1.default);
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// Start
async function start() {
    try {
        // Ensure JWT keys exist
        (0, jwt_1.ensureKeysExist)();
        console.log('[JWT] Keys ready');
        // Connect Redis (optional - falls back to in-memory)
        await (0, redis_1.connectRedis)();
        app.listen(PORT, () => {
            console.log(`\n🥗 NutriBot API running on http://localhost:${PORT}`);
            console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}\n`);
        });
    }
    catch (err) {
        console.error('[Server] Failed to start:', err);
        process.exit(1);
    }
}
start();
//# sourceMappingURL=index.js.map