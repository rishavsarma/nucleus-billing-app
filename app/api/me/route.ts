import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cacheGet, cacheSet } from "@/lib/cache"

const ME_CACHE_TTL_SECONDS = 60

function meCacheKey(userId: string) {
  return `me:${userId}`
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Fast path: cached resolution in Redis
  const cached = await cacheGet(meCacheKey(user.id))
  if (cached) {
    return NextResponse.json(JSON.parse(cached))
  }

  const admin = createAdminClient()

  // Parallelize superadmin check and enriched membership+org query in a single DB round-trip
  const [superadminResult, membershipResult] = await Promise.all([
    admin
      .schema("billing")
      .from("superadmins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .schema("billing")
      .from("memberships")
      .select(`
        org_id,
        role,
        org:organizations(is_active, subscription_status, subscription_current_period_end)
      `)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ])

  const isSuperadmin = !!superadminResult.data

  let orgId: string | null = null
  let role: "owner" | "admin" | "member" | null = null
  let orgStatus: {
    isActive: boolean
    subscriptionStatus: "trialing" | "active" | "past_due" | "cancelled"
    subscriptionCurrentPeriodEnd: string | null
  } | null = null

  if (!isSuperadmin) {
    const membership = membershipResult.data
    if (!membership) {
      return NextResponse.json({ error: "no_org" }, { status: 403 })
    }

    orgId = membership.org_id
    role = membership.role as "owner" | "admin" | "member"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = (membership as any).org
    if (org) {
      orgStatus = {
        isActive: org.is_active,
        subscriptionStatus: org.subscription_status,
        subscriptionCurrentPeriodEnd: org.subscription_current_period_end,
      }
    }
  }

  const payload = {
    userId: user.id,
    email: user.email ?? null,
    name: (user.user_metadata?.full_name as string | undefined) ?? null,
    orgId,
    role,
    isSuperadmin,
    orgStatus,
  }

  await cacheSet(meCacheKey(user.id), JSON.stringify(payload), ME_CACHE_TTL_SECONDS)

  return NextResponse.json(payload)
}
