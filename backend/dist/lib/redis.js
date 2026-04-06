"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
exports.connectRedis = connectRedis;
const ioredis_1 = __importDefault(require("ioredis"));
let redis = null;
// In-memory fallback for when Redis is unavailable
const memoryStore = new Map();
function createRedisClient() {
    if (!process.env.REDIS_URL)
        return null;
    try {
        const client = new ioredis_1.default(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 3)
                    return null; // Stop retrying
                return Math.min(times * 50, 2000);
            },
            lazyConnect: true,
        });
        client.on('error', () => { });
        return client;
    }
    catch {
        return null;
    }
}
// Redis-like interface over memory or real Redis
exports.cache = {
    async get(key) {
        if (redis) {
            try {
                return await redis.get(key);
            }
            catch { /* fall through */ }
        }
        const entry = memoryStore.get(key);
        if (!entry)
            return null;
        if (entry.expiry && Date.now() > entry.expiry) {
            memoryStore.delete(key);
            return null;
        }
        return entry.value;
    },
    async set(key, value, mode, duration) {
        if (redis) {
            try {
                if (mode === 'EX' && duration)
                    await redis.set(key, value, 'EX', duration);
                else
                    await redis.set(key, value);
                return;
            }
            catch { /* fall through */ }
        }
        const expiry = mode === 'EX' && duration ? Date.now() + duration * 1000 : undefined;
        memoryStore.set(key, { value, expiry });
    },
    async del(key) {
        if (redis) {
            try {
                await redis.del(key);
                return;
            }
            catch { /* fall through */ }
        }
        memoryStore.delete(key);
    },
};
async function connectRedis() {
    redis = createRedisClient();
    if (redis) {
        try {
            await redis.connect();
            console.log('[Redis] Connected');
        }
        catch (err) {
            console.warn('[Redis] Connection failed, using in-memory store:', err.message);
            redis = null;
        }
    }
    else {
        console.log('[Redis] No REDIS_URL, using in-memory store');
    }
}
exports.default = redis;
//# sourceMappingURL=redis.js.map