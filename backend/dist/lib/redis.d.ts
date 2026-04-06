import Redis from 'ioredis';
declare let redis: Redis | null;
export declare const cache: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: string, duration?: number): Promise<void>;
    del(key: string): Promise<void>;
};
export declare function connectRedis(): Promise<void>;
export default redis;
//# sourceMappingURL=redis.d.ts.map