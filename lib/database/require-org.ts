import "server-only"
import { createHash } from "crypto"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { redis } from "@/lib/redis"

async function checkSuperadmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .schema("billing")
    .from("superadmins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle()
  return !!data
}

// ---------------------------------------------------------------------------
// Auth-result cache
// ---------------------------------------------------------------------------
// supabase.auth.getUser() makes a network round-trip to the Supabase Auth
// server on every call (~1s on warm Redis, ~150ms on cold). We cache the
// resolved { userId, orgId, isSuperadmin } tuple in Redis keyed by a hash
// of the access token so subsequent requests skip that round-trip entirely.
//
// TTL is intentionally short (60s) so that role/membership changes propagate
// quickly. The access token itself rotates on every middleware refresh, which
// naturally busts the cache entry for the old token anyway.
const AUTH_CACHE_TTL_SECONDS = 60

type AuthPayload = {
  userId: string
  orgId: string | null
  isSuperadmin: boolean
}

/**
 * Extracts the real access_token JWT from the Supabase session cookie.
 *
 * @supabase/ssr 0.12.x encodes the session as:
 *   "base64-<base64-encoded JSON>"
 * where the JSON is { access_token, refresh_token, expires_at, token_type, ... }.
 *
 * We decode and extract access_token specifically — so the hash key is over
 * the actual JWT, not the whole session blob. This matters if anyone later
 * tries to forward this value as a real bearer token (e.g. getUser(token)).
 * Caching still works either way since the blob is unique-per-session and
 * rotates on refresh, but using the real JWT is semantically correct.
 */
async function getAccessToken(): Promise<string | null> {
  const jar = await cookies()
  const all = jar.getAll()

  // Handle single cookie or chunked cookies (sb-<ref>-auth-token.0, .1, etc.)
  const single = all.find(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  )
  let raw = ""
  if (single) {
    raw = single.value
  } else {
    const chunks = all
      .filter(
        (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token.")
      )
      .sort((a, b) => {
        const idxA = parseInt(a.name.split(".").pop() || "0", 10)
        const idxB = parseInt(b.name.split(".").pop() || "0", 10)
        return idxA - idxB
      })
    if (chunks.length > 0) {
      raw = chunks.map((c) => c.value).join("")
    }
  }

  if (!raw) return null

  try {
    const jsonStr = raw.startsWith("base64-")
      ? Buffer.from(raw.slice(7), "base64").toString("utf8")
      : raw
    const session = JSON.parse(jsonStr)
    if (Array.isArray(session))
      return typeof session[0] === "string" ? session[0] : null
    return (session as { access_token?: string })?.access_token ?? null
  } catch {
    if (raw.startsWith("eyJ")) return raw
    return null
  }
}

function authCacheKey(tokenHash: string) {
  return `auth:${tokenHash}`
}

/** SHA-256 hex of the access token — stable for the token's lifetime. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

// Set REDIS_CACHE_DISABLED=1 to make the auth-result cache below a
// permanent no-op — see the matching flag on lib/cache.ts for the
// list/read cache layer; set both for "no Redis caching anywhere."
const authCacheDisabled = process.env.REDIS_CACHE_DISABLED === "1"

/** Best-effort read from the auth cache. Returns null on any failure. */
async function authCacheGet(tokenHash: string): Promise<AuthPayload | null> {
  if (authCacheDisabled) return null
  try {
    const raw = await redis.get(authCacheKey(tokenHash))
    if (!raw) return null
    return JSON.parse(raw) as AuthPayload
  } catch {
    return null
  }
}

/** Best-effort write to the auth cache. Never throws. */
async function authCacheSet(
  tokenHash: string,
  payload: AuthPayload
): Promise<void> {
  if (authCacheDisabled) return
  try {
    await redis.set(
      authCacheKey(tokenHash),
      JSON.stringify(payload),
      "EX",
      AUTH_CACHE_TTL_SECONDS
    )
  } catch {
    // swallow — a failed write just means the next request is a cache miss
  }
}

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type RequireOrgResult =
  | {
      orgId: string | null
      userId: string
      isSuperadmin: boolean
      supabase: SupabaseClient
      error?: undefined
    }
  | {
      orgId?: undefined
      userId?: undefined
      isSuperadmin?: undefined
      supabase?: undefined
      error: "unauthorized" | "no_org"
    }

/**
 * Resolves the requesting user's org via billing.memberships, unless they're a
 * superadmin — superadmins get `orgId: null` and `isSuperadmin: true`, meaning
 * "don't filter by org, they can see/touch every org." Callers must branch on
 * `isSuperadmin` and skip the `.eq("org_id", ...)` filter when it's true.
 * Assumes one org per (non-superadmin) user.
 *
 * Also returns the Supabase client so callers can reuse it for their own
 * queries without a second createClient() call.
 *
 * Auth results are cached in Redis for AUTH_CACHE_TTL_SECONDS to avoid
 * paying a Supabase Auth network round-trip on every hot-path request.
 */
// TEMP: DEBUG_AUTH_TIMING=1 logs a per-stage breakdown of requireOrgId() to
// stdout — added to diagnose the ~400ms-vs-~50ms gap reported while testing
// with REDIS_CACHE_DISABLED=1. Remove once diagnosed.
const debugAuthTiming = process.env.DEBUG_AUTH_TIMING === "1"

export async function requireOrgId(): Promise<RequireOrgResult> {
  const t0 = performance.now()
  const supabase = await createClient()
  const tClient = performance.now()

  // Fast path: check Redis before hitting the Supabase Auth server.
  // Superadmin hits are never served from cache — superadmins have
  // cross-tenant access and must be re-verified every request.
  const accessToken = await getAccessToken()
  const tToken = performance.now()
  if (accessToken) {
    const tokenHash = hashToken(accessToken)
    const cached = await authCacheGet(tokenHash)
    const tCache = performance.now()
    if (cached && !cached.isSuperadmin) {
      if (debugAuthTiming) {
        console.log(
          `[auth-timing] CACHE HIT client=${(tClient - t0).toFixed(1)}ms token=${(tToken - tClient).toFixed(1)}ms cacheGet=${(tCache - tToken).toFixed(1)}ms total=${(tCache - t0).toFixed(1)}ms`
        )
      }
      return {
        userId: cached.userId,
        orgId: cached.orgId,
        isSuperadmin: false,
        supabase,
      }
    }
  }
  const tCacheMiss = performance.now()

  // Slow path: validate token with Supabase Auth + resolve org membership.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const tGetUser = performance.now()

  if (!user) {
    return { error: "unauthorized" }
  }

  // Run the superadmin check and membership lookup in parallel — for the
  // common non-superadmin case this saves one sequential round-trip.
  const [isSuperadmin, membership] = await Promise.all([
    checkSuperadmin(supabase, user.id),
    supabase
      .schema("billing")
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),
  ])
  const tMembership = performance.now()

  if (debugAuthTiming) {
    console.log(
      `[auth-timing] CACHE MISS client=${(tClient - t0).toFixed(1)}ms token=${(tToken - tClient).toFixed(1)}ms cacheGet=${(tCacheMiss - tToken).toFixed(1)}ms getUser=${(tGetUser - tCacheMiss).toFixed(1)}ms membership=${(tMembership - tGetUser).toFixed(1)}ms total=${(tMembership - t0).toFixed(1)}ms`
    )
  }

  if (isSuperadmin) {
    // Never cache superadmin auth — always re-verify next request.
    return { orgId: null, userId: user.id, isSuperadmin: true, supabase }
  }

  if (!membership) {
    return { error: "no_org" }
  }

  const payload: AuthPayload = {
    userId: user.id,
    orgId: membership.org_id as string,
    isSuperadmin: false,
  }
  if (accessToken) void authCacheSet(hashToken(accessToken), payload)

  return {
    orgId: payload.orgId,
    userId: user.id,
    isSuperadmin: false,
    supabase,
  }
}

export type RequireUserResult =
  | {
      userId: string
      supabase: SupabaseClient
      isSuperadmin?: boolean
      error?: undefined
    }
  | {
      userId?: undefined
      supabase?: undefined
      isSuperadmin?: undefined
      error: "unauthorized"
    }

/** Weaker check for routes that don't require org membership yet (e.g. creating the first org). */
export async function requireUserId(): Promise<RequireUserResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "unauthorized" }
  }

  return { userId: user.id, supabase }
}

/** Verifies the requesting user belongs to the given org (any role), or is a superadmin. */
export async function requireMemberOf(
  orgId: string
): Promise<RequireUserResult> {
  const supabase = await createClient()

  // Fast path: check Redis before hitting Supabase Auth server
  const accessToken = await getAccessToken()
  if (accessToken) {
    const tokenHash = hashToken(accessToken)
    const cached = await authCacheGet(tokenHash)
    if (cached && !cached.isSuperadmin && cached.orgId === orgId) {
      return { userId: cached.userId, isSuperadmin: false, supabase }
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "unauthorized" }
  }

  if (await checkSuperadmin(supabase, user.id)) {
    return { userId: user.id, isSuperadmin: true, supabase }
  }

  const { data: membership } = await supabase
    .schema("billing")
    .from("memberships")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle()

  if (!membership) {
    return { error: "unauthorized" }
  }

  return { userId: user.id, isSuperadmin: false, supabase }
}

/**
 * Verifies the requesting user is an owner/admin of the given org, or a
 * superadmin. Use this for org-level settings writes.
 *
 * The database already enforces this — organizations_update RLS requires
 * billing.is_org_admin(id) — but a route gated only on membership let a plain
 * member through the handler and then got an empty result back from RLS,
 * surfacing as a confusing 404 rather than a 403 (audit NB-09).
 *
 * Deliberately not served from the auth cache: that cache stores only
 * { userId, orgId, isSuperadmin } and carries no role, so a cached hit can't
 * answer "is this user an admin".
 */
export async function requireAdminOf(
  orgId: string
): Promise<RequireUserResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "unauthorized" }
  }

  if (await checkSuperadmin(supabase, user.id)) {
    return { userId: user.id, isSuperadmin: true, supabase }
  }

  const { data: membership } = await supabase
    .schema("billing")
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle()

  if (!membership || !["owner", "admin"].includes(membership.role as string)) {
    return { error: "unauthorized" }
  }

  return { userId: user.id, isSuperadmin: false, supabase }
}

/**
 * Verifies that a row identified by `id` in `table` belongs to the given org
 * (or passes unconditionally for a superadmin). Use this to validate any
 * foreign-key reference supplied in a request body — e.g. checking that
 * body.customer_id on a new invoice actually belongs to the caller's org —
 * before writing it, since RLS's insert/update policies only check org_id
 * (or, for *_items tables, the immediate parent), not sibling FK columns.
 */
export async function verifyBelongsToOrg(
  supabase: SupabaseClient,
  table: string,
  id: string,
  orgId: string | null,
  isSuperadmin: boolean
): Promise<boolean> {
  let query = supabase.schema("billing").from(table).select("id").eq("id", id)
  if (!isSuperadmin) query = query.eq("org_id", orgId!)
  const { data } = await query.maybeSingle()
  return !!data
}

/**
 * Same purpose as verifyBelongsToOrg, but for a foreign key that points at
 * a *child* table with no org_id column of its own (e.g. invoice_items,
 * purchase_bill_items) — verifyBelongsToOrg's `.eq("org_id", orgId)` would
 * always fail against a table like that, since the column doesn't exist.
 * Resolves the child row's own parent-FK column, then checks that parent
 * (which does have org_id) via verifyBelongsToOrg.
 */
export async function verifyChildBelongsToOrg(
  supabase: SupabaseClient,
  childTable: string,
  childId: string,
  parentFkColumn: string,
  parentTable: string,
  orgId: string | null,
  isSuperadmin: boolean
): Promise<boolean> {
  const { data: child } = await supabase
    .schema("billing")
    .from(childTable)
    .select(parentFkColumn)
    .eq("id", childId)
    .maybeSingle()
  if (!child) return false
  const parentId = (child as unknown as Record<string, string>)[parentFkColumn]
  return verifyBelongsToOrg(
    supabase,
    parentTable,
    parentId,
    orgId,
    isSuperadmin
  )
}

/** Verifies the requesting user is listed in billing.superadmins (a global, non-org-scoped role). */
export async function requireSuperadmin(): Promise<RequireUserResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "unauthorized" }
  }

  if (!(await checkSuperadmin(supabase, user.id))) {
    return { error: "unauthorized" }
  }

  return { userId: user.id, isSuperadmin: true, supabase }
}
