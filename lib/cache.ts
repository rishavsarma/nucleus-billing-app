import { redis } from "@/lib/redis";

// A hard ceiling on top of the redis client's own maxRetriesPerRequest/
// connectTimeout tuning (see lib/redis.ts) — belt and suspenders, so a
// misbehaving connection can never make an API route wait meaningfully
// long for a cache hit that was never coming.
const CACHE_TIMEOUT_MS = 150;

// --- Circuit breaker -------------------------------------------------
// Without this, an unreachable Redis pays its full timeout cost (up to
// CACHE_TIMEOUT_MS) on *every single call, forever* — a get + a set on
// every cached request, indefinitely, for as long as the outage lasts.
// Once a handful of calls fail in a row, stop even trying for a cooldown
// window and go straight to "miss" — the caller falls through to the
// database at full speed instead of paying a repeated cache tax for an
// outage we already know about. After the cooldown, one call is let
// through to probe recovery; success closes the circuit again.
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 10_000;

let consecutiveFailures = 0;
let openUntil = 0;

function circuitOpen(): boolean {
  return consecutiveFailures >= FAILURE_THRESHOLD && Date.now() < openUntil;
}

function recordSuccess(): void {
  consecutiveFailures = 0;
  openUntil = 0;
}

function recordFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    openUntil = Date.now() + COOLDOWN_MS;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`cache operation timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Best-effort cache read. Returns null on any failure (Redis
 * unreachable, timeout, circuit open, etc.) instead of throwing — a
 * cache outage degrades to "always miss and hit the database," never to
 * a broken or hung request. */
export async function cacheGet(key: string): Promise<string | null> {
  if (circuitOpen()) return null;
  try {
    const value = await withTimeout(redis.get(key), CACHE_TIMEOUT_MS);
    recordSuccess();
    return value;
  } catch (error) {
    recordFailure();
    console.warn(`[cache] get failed for "${key}":`, error instanceof Error ? error.message : error);
    return null;
  }
}

/** Best-effort cache write. Never throws — a failed write just means the
 * next read is a cache miss, not a broken request. */
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (circuitOpen()) return;
  try {
    await withTimeout(redis.set(key, value, "EX", ttlSeconds), CACHE_TIMEOUT_MS);
    recordSuccess();
  } catch (error) {
    recordFailure();
    console.warn(`[cache] set failed for "${key}":`, error instanceof Error ? error.message : error);
  }
}

/** Best-effort cache invalidation. Never throws — the write it's meant to
 * follow up on has already succeeded regardless; worst case here is a
 * stale cache entry that expires on its own via TTL. */
export async function cacheDel(key: string): Promise<void> {
  if (circuitOpen()) return;
  try {
    await withTimeout(redis.del(key), CACHE_TIMEOUT_MS);
    recordSuccess();
  } catch (error) {
    recordFailure();
    console.warn(`[cache] del failed for "${key}":`, error instanceof Error ? error.message : error);
  }
}
