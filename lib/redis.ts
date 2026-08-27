import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL!, {
    keyPrefix: "nucleus-billing-app:",
    // ioredis's defaults (maxRetriesPerRequest: 20, connectTimeout: 10s)
    // are tuned for "keep trying, this matters" use cases like a job
    // queue. For a read-through cache, a single slow/unreachable Redis
    // must never make a request wait — commands should fail fast so the
    // caller can fall back to the database instead. The client itself
    // still keeps retrying to reconnect in the background (that's
    // retryStrategy, left at its default); this only bounds how long any
    // one command waits before giving up.
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;