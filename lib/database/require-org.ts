import "server-only"
import { createClient } from "@/lib/supabase/server"

async function checkSuperadmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .schema("billing")
    .from("superadmins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle()
  return !!data
}

type RequireOrgResult =
  | { orgId: string | null; userId: string; isSuperadmin: boolean; error?: undefined }
  | {
      orgId?: undefined
      userId?: undefined
      isSuperadmin?: undefined
      error: "unauthorized" | "no_org"
    }

/**
 * Resolves the requesting user's org via billing.memberships, unless they're a
 * superadmin — superadmins get `orgId: null` and `isSuperadmin: true`, meaning
 * "don't filter by org, they can see/touch every org." Callers must branch on
 * `isSuperadmin` and skip the `.eq("org_id", ...)` filter when it's true.
 * Assumes one org per (non-superadmin) user.
 */
export async function requireOrgId(): Promise<RequireOrgResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "unauthorized" }
  }

  if (await checkSuperadmin(supabase, user.id)) {
    return { orgId: null, userId: user.id, isSuperadmin: true }
  }

  const { data: membership } = await supabase
    .schema("billing")
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return { error: "no_org" }
  }

  return { orgId: membership.org_id as string, userId: user.id, isSuperadmin: false }
}

type RequireUserResult =
  | { userId: string; error?: undefined }
  | { userId?: undefined; error: "unauthorized" }

/** Weaker check for routes that don't require org membership yet (e.g. creating the first org). */
export async function requireUserId(): Promise<RequireUserResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "unauthorized" }
  }

  return { userId: user.id }
}

/** Verifies the requesting user belongs to the given org (any role), or is a superadmin. */
export async function requireMemberOf(orgId: string): Promise<RequireUserResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "unauthorized" }
  }

  if (await checkSuperadmin(supabase, user.id)) {
    return { userId: user.id }
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

  return { userId: user.id }
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
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  id: string,
  orgId: string | null,
  isSuperadmin: boolean,
): Promise<boolean> {
  let query = supabase.schema("billing").from(table).select("id").eq("id", id)
  if (!isSuperadmin) query = query.eq("org_id", orgId!)
  const { data } = await query.maybeSingle()
  return !!data
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

  return { userId: user.id }
}
