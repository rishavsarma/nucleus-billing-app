import "server-only"
import { NextResponse } from "next/server"

/**
 * Shared response helpers for route handlers under app/api/.
 *
 * Two audit findings drove these:
 *
 * - NB-08: handlers returned `{ error: error.message }` straight from
 *   PostgREST/Postgres, leaking table and column names, constraint names and
 *   raw `raise exception` text to the client — which also made schema
 *   enumeration through the search parameter practical.
 * - NB-12: `await request.json()` throws on a malformed body and nothing
 *   caught it, so bad JSON surfaced as an unhandled 500 (and Sentry noise)
 *   instead of a 400.
 *
 * The stable-`code` convention here matches app/api/auth/login/route.ts, which
 * already did this properly: the client switches on `code`, never on prose.
 */

/** Postgres SQLSTATEs worth translating into a specific, non-leaky message. */
const PG_CODE_MAP: Record<
  string,
  { status: number; code: string; error: string }
> = {
  "23505": {
    status: 409,
    code: "duplicate",
    error: "That record already exists.",
  },
  "23503": {
    status: 400,
    code: "invalid_reference",
    error: "A referenced record does not exist.",
  },
  "23514": {
    status: 400,
    code: "constraint_violation",
    error: "That change isn't allowed.",
  },
  "23502": {
    status: 400,
    code: "missing_required_field",
    error: "A required field is missing.",
  },
  "22P02": {
    status: 400,
    code: "invalid_input",
    error: "One of the values sent isn't valid.",
  },
  // Raised by the status-transition / derived-column / membership-limit guards.
  P0001: {
    status: 400,
    code: "rule_violation",
    error: "That change isn't allowed.",
  },
}

type DbErrorLike = {
  message?: string
  code?: string
  details?: string | null
  hint?: string | null
}

/**
 * Turns a Supabase/PostgREST error into a client-safe response, logging the
 * real thing server-side (picked up by Sentry) so nothing is lost.
 *
 * `context` should identify the call site, e.g. "invoices:PUT".
 */
export function dbError(
  error: DbErrorLike | null | undefined,
  context: string
): NextResponse {
  console.error(`[db] ${context}:`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  })

  const mapped = error?.code ? PG_CODE_MAP[error.code] : undefined
  if (mapped) {
    return NextResponse.json(
      { error: mapped.error, code: mapped.code },
      { status: mapped.status }
    )
  }

  return NextResponse.json(
    {
      error: "Something went wrong handling that request.",
      code: "internal_error",
    },
    { status: 500 }
  )
}

/**
 * Parses a JSON request body, returning `null` instead of throwing when the
 * body is absent or malformed. Callers return `badRequest("invalid_json")`.
 */
export async function readJson(
  request: Request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any> | null> {
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null
    // `any` values (rather than `unknown`) deliberately: handlers read FK ids
    // straight off this for verifyBelongsToOrg calls, and what actually
    // reaches the database is pickAllowed()'s output, not this object.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return parsed as Record<string, any>
  } catch {
    return null
  }
}

/** 400 with a stable code the client can translate. */
export function badRequest(
  code: string,
  error: string,
  status = 400
): NextResponse {
  return NextResponse.json({ error, code }, { status })
}

/** The standard auth failure shape every database route already returns. */
export function authError(error: "unauthorized" | "no_org"): NextResponse {
  return NextResponse.json(
    { error, code: error },
    { status: error === "unauthorized" ? 401 : 403 }
  )
}

/** 404 with a stable code. */
export function notFound(): NextResponse {
  return NextResponse.json(
    { error: "Not found", code: "not_found" },
    { status: 404 }
  )
}
