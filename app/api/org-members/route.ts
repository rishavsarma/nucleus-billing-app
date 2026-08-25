import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireOrgId } from "@/lib/database/require-org"

// Composed read, not a direct billing-table passthrough: `billing.memberships`
// only stores `user_id` (no name/email — that lives in `auth.users`, a
// different schema the browser client can't join against). This route
// enriches each membership with its email via the service-role admin client,
// scoped strictly to the caller's own org's memberships, so it never exposes
// another org's users. Read-only — inviting/removing members still goes
// through the plain `billing.memberships` CRUD in
// app/api/database/memberships/route.ts.
export async function GET() {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  // Superadmins aren't scoped to a single org, so there's no "my org's
  // members" list to return here.
  if (!auth.orgId) {
    return NextResponse.json([])
  }

  const supabase = await createClient()
  const { data: memberships, error } = await supabase
    .schema("billing")
    .from("memberships")
    .select("*")
    .eq("org_id", auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = createAdminClient()
  const enriched = await Promise.all(
    memberships.map(async (membership) => {
      const { data } = await admin.auth.admin.getUserById(membership.user_id)
      return { ...membership, email: data?.user?.email ?? null }
    }),
  )

  return NextResponse.json(enriched)
}
