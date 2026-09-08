import "server-only"
import { redis } from "@/lib/redis"

// Same belt-and-suspenders timeout pattern as lib/cache.ts — a rate-limit
// check must never make a real request wait meaningfully long.
const RATE_LIMIT_TIMEOUT_MS = 150

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`rate-limit operation timed out after ${ms}ms`)),
      ms
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Seconds until the window resets — meaningful whether allowed or not,
   * so a caller combining multiple limiters can report the longer wait. */
  retryAfterSeconds: number
}

/**
 * Fixed-window rate limiter backed by Redis INCR+EXPIRE. `key` should
 * already be scoped (e.g. `login-ip:<ip>`) — this function only adds the
 * `ratelimit:` prefix.
 *
 * Fails OPEN (allows the request) if Redis is unreachable or slow — a
 * rate-limit outage should degrade to "no rate limiting for now," never to
 * "nobody can log in." Matches lib/cache.ts's existing philosophy of never
 * letting a Redis hiccup break a real request; the tradeoff (briefly
 * unlimited attempts during a Redis outage) is strictly better than a
 * total lockout.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`
  try {
    const count = await withTimeout(redis.incr(redisKey), RATE_LIMIT_TIMEOUT_MS)
    if (count === 1) {
      // First hit in this window — start the clock. A crash between INCR
      // and EXPIRE would leave this key without a TTL (never expiring),
      // but that only makes the limit permanently stricter, never
      // permanently open — the safe direction for a security control.
      await withTimeout(
        redis.expire(redisKey, windowSeconds),
        RATE_LIMIT_TIMEOUT_MS
      )
    }
    if (count > limit) {
      const ttl = await withTimeout(redis.ttl(redisKey), RATE_LIMIT_TIMEOUT_MS)
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
      }
    }
    return {
      allowed: true,
      remaining: limit - count,
      retryAfterSeconds: windowSeconds,
    }
  } catch (error) {
    console.warn(
      `[rate-limit] check failed for "${redisKey}":`,
      error instanceof Error ? error.message : error
    )
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 }
  }
}

/** Best-effort client IP extraction from standard reverse-proxy headers
 * (Vercel/Coolify/most hosts set x-forwarded-for). Falls back to a shared
 * bucket when nothing is present (e.g. direct local dev access) rather
 * than throwing — the per-email limiter still applies either way. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return "unknown"
}
