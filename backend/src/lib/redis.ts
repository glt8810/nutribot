import Redis from 'ioredis';

let redis: Redis | null = null;

// In-memory fallback for when Redis is unavailable
const memoryStore = new Map<string, { value: string; expiry?: number }>();

function createRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  try {
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) return null; // Stop retrying
        return Math.min(times * 50, 2000);
      },
      lazyConnect: true,
    });
    client.on('error', () => { /* silently ignore */ });
    return client;
  } catch {
    return null;
  }
}

// Redis-like interface over memory or real Redis
export const cache = {
  async get(key: string): Promise<string | null> {
    if (redis) {
      try { return await redis.get(key); } catch { /* fall through */ }
    }
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      memoryStore.delete(key);
      return null;
    }
    return entry.value;
  },
  async set(key: string, value: string, mode?: string, duration?: number): Promise<void> {
    if (redis) {
      try {
        if (mode === 'EX' && duration) await redis.set(key, value, 'EX', duration);
        else await redis.set(key, value);
        return;
      } catch { /* fall through */ }
    }
    const expiry = mode === 'EX' && duration ? Date.now() + duration * 1000 : undefined;
    memoryStore.set(key, { value, expiry });
  },
  async del(key: string): Promise<void> {
    if (redis) {
      try { await redis.del(key); return; } catch { /* fall through */ }
    }
    memoryStore.delete(key);
  },
};

export async function connectRedis(): Promise<void> {
  redis = createRedisClient();
  if (redis) {
    try {
      await redis.connect();
      console.log('[Redis] Connected');
    } catch (err: any) {
      console.warn('[Redis] Connection failed, using in-memory store:', err.message);
      redis = null;
    }
  } else {
    console.log('[Redis] No REDIS_URL, using in-memory store');
  }
}

export default redis;
