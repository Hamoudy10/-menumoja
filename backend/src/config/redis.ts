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

const memoryStore = new Map<string, { value: any; expiresAt: number }>();

const memoryRedis: RedisLike = {
  get: async (key: string) => {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { memoryStore.delete(key); return null; }
    return entry.value;
  },
  set: async (key: string, value: any, ...args: any[]) => {
    const ttlIndex = args.findIndex((a: any) => a === 'EX' || a === 'PX');
    let ttlMs = 0;
    if (ttlIndex >= 0 && ttlIndex + 1 < args.length) {
      const num = Number(args[ttlIndex + 1]);
      ttlMs = args[ttlIndex] === 'PX' ? num : num * 1000;
    }
    memoryStore.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : Infinity });
  },
  setex: async (key: string, seconds: number, value: any) => {
    memoryStore.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
  },
  del: async (...keys: string[]) => {
    let count = 0;
    keys.forEach((k) => { if (memoryStore.delete(k)) count++; });
    return count;
  },
  expire: async (key: string, seconds: number) => {
    const entry = memoryStore.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  },
  incr: async (key: string) => {
    const entry = memoryStore.get(key);
    const next = entry ? Number(entry.value) + 1 : 1;
    memoryStore.set(key, { value: String(next), expiresAt: Infinity });
    return next;
  },
  exists: async (...keys: string[]) => keys.filter((k) => memoryStore.has(k)).length,
  ttl: async (key: string) => {
    const entry = memoryStore.get(key);
    if (!entry) return -2;
    const remaining = Math.floor((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  },
  keys: async (pattern: string) => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(memoryStore.keys()).filter((k) => regex.test(k));
  },
  quit: async () => { memoryStore.clear(); },
  on: () => {},
  status: 'disabled',
};

let redis: RedisLike = memoryRedis;

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
    const origIncr = client.incr.bind(client);
    const origExpire = client.expire.bind(client);
    const origExists = client.exists.bind(client);
    const origKeys = client.keys.bind(client);

    client.get = async (key: string) => { try { return await origGet(key); } catch { return null; } };
    client.set = async (key: string, value: any, ...args: any[]) => { try { return await origSet(key, value, ...args); } catch { return; } };
    client.setex = async (key: string, seconds: number, value: any) => { try { return await origSetex(key, seconds, value); } catch { return; } };
    client.del = async (...keys: string[]) => { try { return await origDel(...keys); } catch { return 0; } };
    client.ttl = async (key: string) => { try { return await origTtl(key); } catch { return -2; } };
    client.incr = async (key: string) => { try { return await origIncr(key); } catch { return 1; } };
    client.expire = async (key: string, seconds: number) => { try { return await origExpire(key, seconds); } catch { return 0; } };
    client.exists = async (...keys: string[]) => { try { return await origExists(...keys); } catch { return 0; } };
    client.keys = async (pattern: string) => { try { return await origKeys(pattern); } catch { return []; } };

    redis = client;
  } catch {
    console.warn('⚠️ Redis unavailable — running without cache and queues');
  }
} else {
  console.log('ℹ️ Redis not configured — using in-memory fallback');
}

export { redis };
