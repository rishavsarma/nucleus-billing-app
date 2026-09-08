import "server-only"
import { redis } from "@/lib/redis"

// Short window to claim a key (covers the actual request duration) vs. the
// long window a completed result stays replayable for (covers a client
// retry minutes later after a dropped response, without replaying forever).
const CLAIM_TTL_SECONDS = 30
const RESULT_TTL_SECONDS = 24 * 60 * 60
const IDEMPOTENCY_TIMEOUT_MS = 200

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`idempotency operation timed out after ${ms}ms`)),
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

type StoredResult =
  { status: "pending" } | { status: "done"; httpStatus: number; body: unknown }

function idempotencyKeyFor(orgId: string, route: string, key: string): string {
  return `idempotency:${route}:${orgId}:${key}`
}

/**
 * Call at the top of a mutating route handler, before doing any writes.
 *
 * - `{ outcome: "proceed" }` — no prior attempt with this key; the caller
 *   should do the real write, then call `completeIdempotentRequest`.
 * - `{ outcome: "replay", httpStatus, body }` — this exact key already
 *   completed; return the stored response as-is instead of writing again.
 * - `{ outcome: "in_progress" }` — this exact key is currently being
 *   processed by a concurrent request (e.g. a genuine double-click that
 *   both reached the server); the caller should return 409 rather than
 *   risk a second concurrent write.
 *
 * Fails open on any Redis error (returns "proceed") — the same tradeoff as
 * lib/rate-limit.ts and lib/cache.ts: an idempotency-store outage should
 * degrade to "no duplicate protection for now," never to "nobody can
 * record a payment."
 */
export async function beginIdempotentRequest(
  orgId: string,
  route: string,
  key: string | null
): Promise<
  | { outcome: "proceed" }
  | { outcome: "replay"; httpStatus: number; body: unknown }
  | { outcome: "in_progress" }
> {
  if (!key) return { outcome: "proceed" }

  const redisKey = idempotencyKeyFor(orgId, route, key)
  try {
    const claimed = await withTimeout(
      redis.set(
        redisKey,
        JSON.stringify({ status: "pending" } satisfies StoredResult),
        "EX",
        CLAIM_TTL_SECONDS,
        "NX"
      ),
      IDEMPOTENCY_TIMEOUT_MS
    )
    if (claimed === "OK") return { outcome: "proceed" }

    // Key already exists — find out whether it's a finished result to
    // replay or a concurrent attempt still in flight.
    const existing = await withTimeout(
      redis.get(redisKey),
      IDEMPOTENCY_TIMEOUT_MS
    )
    if (!existing) return { outcome: "proceed" } // raced past expiry between SET NX and GET
    const parsed = JSON.parse(existing) as StoredResult
    if (parsed.status === "done")
      return {
        outcome: "replay",
        httpStatus: parsed.httpStatus,
        body: parsed.body,
      }
    return { outcome: "in_progress" }
  } catch (error) {
    console.warn(
      `[idempotency] begin failed for "${redisKey}":`,
      error instanceof Error ? error.message : error
    )
    return { outcome: "proceed" }
  }
}

/** Call after a successful write to record the response for replay. Safe
 * to skip on error paths — an idempotency key is only meant to protect a
 * write that actually happened; a failed attempt should be retryable. */
export async function completeIdempotentRequest(
  orgId: string,
  route: string,
  key: string | null,
  httpStatus: number,
  body: unknown
): Promise<void> {
  if (!key) return
  const redisKey = idempotencyKeyFor(orgId, route, key)
  try {
    await withTimeout(
      redis.set(
        redisKey,
        JSON.stringify({
          status: "done",
          httpStatus,
          body,
        } satisfies StoredResult),
        "EX",
        RESULT_TTL_SECONDS
      ),
      IDEMPOTENCY_TIMEOUT_MS
    )
  } catch (error) {
    console.warn(
      `[idempotency] complete failed for "${redisKey}":`,
      error instanceof Error ? error.message : error
    )
  }
}

/** Release a claimed key on a failed attempt so a genuine retry (after
 * fixing a validation error, say) isn't stuck replaying "in progress"
 * until the short claim TTL expires on its own. */
export async function releaseIdempotentRequest(
  orgId: string,
  route: string,
  key: string | null
): Promise<void> {
  if (!key) return
  const redisKey = idempotencyKeyFor(orgId, route, key)
  try {
    await withTimeout(redis.del(redisKey), IDEMPOTENCY_TIMEOUT_MS)
  } catch (error) {
    console.warn(
      `[idempotency] release failed for "${redisKey}":`,
      error instanceof Error ? error.message : error
    )
  }
}
