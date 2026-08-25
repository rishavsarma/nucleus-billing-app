import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// This route deliberately does NOT use requireOrgId(): that helper resolves
// org membership through the regular (RLS-enabled) client, and
// memberships_select's RLS policy requires is_org_member(org_id) — which
// itself requires the org to be is_active AND have a healthy
// subscription_status. That means a member of a suspended or lapsed org
// can't even resolve their own org_id through the normal path, so every
// route built on requireOrgId() (correctly) 403s "no_org" for them. Since
// this route's entire purpose is telling a locked-out member *why* that's
// happening, it has to bypass that same gate via the service-role client —
// otherwise the diagnostic endpoint fails for exactly the users who need it.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: superadminRow } = await admin
    .schema("billing")
    .from("superadmins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()
  const isSuperadmin = !!superadminRow

  let orgId: string | null = null
  let orgStatus: {
    isActive: boolean
    subscriptionStatus: "trialing" | "active" | "past_due" | "cancelled"
    subscriptionCurrentPeriodEnd: string | null
  } | null = null

  if (!isSuperadmin) {
    const { data: membership } = await admin
      .schema("billing")
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: "no_org" }, { status: 403 })
    }
    orgId = membership.org_id

    const { data: org } = await admin
      .schema("billing")
      .from("organizations")
      .select("is_active, subscription_status, subscription_current_period_end")
      .eq("id", orgId)
      .maybeSingle()

    if (org) {
      orgStatus = {
        isActive: org.is_active,
        subscriptionStatus: org.subscription_status,
        subscriptionCurrentPeriodEnd: org.subscription_current_period_end,
      }
    }
  }

  return NextResponse.json({
    userId: user.id,
    orgId,
    isSuperadmin,
    orgStatus,
  })
}
