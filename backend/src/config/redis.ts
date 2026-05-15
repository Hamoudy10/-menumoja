import { config } from './index';

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: any, ...args: any[]): Promise<any>;
  setex(key: string, seconds: number, value: any): Promise<any>;
  del(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  incr(key: string): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  quit(): Promise<void>;
  on(event: string, handler: (...args: any[]) => void): void;
  status: string;
}

const nullRedis: RedisLike = {
  get: async () => null,
  set: async () => {},
  setex: async () => {},
  del: async () => 0,
  expire: async () => 0,
  incr: async () => 1,
  exists: async () => 0,
  ttl: async () => -2,
  keys: async () => [],
  quit: async () => {},
  on: () => {},
  status: 'disabled',
};

let redis: RedisLike = nullRedis;

if (config.redisUrl && !config.redisUrl.includes('localhost')) {
  try {
    const IORedis = require('ioredis');
    const client = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times: number) {
        if (times > 3) return null;
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    client.on('error', () => {});
    client.on('connect', () => { console.log('✅ Redis connected'); });

    const origGet = client.get.bind(client);
    const origSet = client.set.bind(client);
    const origSetex = client.setex.bind(client);
    const origDel = client.del.bind(client);
    const origTtl = client.ttl.bind(client);

    client.get = async (key: string) => { try { return await origGet(key); } catch { return null; } };
    client.set = async (key: string, value: any, ...args: any[]) => { try { return await origSet(key, value, ...args); } catch { return; } };
    client.setex = async (key: string, seconds: number, value: any) => { try { return await origSetex(key, seconds, value); } catch { return; } };
    client.del = async (...keys: string[]) => { try { return await origDel(...keys); } catch { return 0; } };
    client.ttl = async (key: string) => { try { return await origTtl(key); } catch { return -2; } };

    redis = client;
  } catch {
    console.warn('⚠️ Redis unavailable — running without cache and queues');
  }
} else {
  console.log('ℹ️ Redis not configured — using in-memory fallback');
}

export { redis };
