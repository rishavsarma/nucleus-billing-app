import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireOrgId, requireSuperadmin } from "@/lib/database/require-org"

export async function GET() {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const supabase = await createClient()
  let query = supabase.schema("billing").from("organization_addon_subscriptions").select("*")
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Writes only ever go through billing.subscribe_org_to_addon /
// billing.cancel_org_addon — both superadmin-gated inside the function body
// (see 003_rls_policies.sql), so this route requires requireSuperadmin() too
// rather than relying on the DB to reject a non-superadmin's call.
export async function POST(request: Request) {
  const auth = await requireSuperadmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 403 })
  }

  const body = await request.json()
  const { org_id, addon_slug } = body as { org_id?: string; addon_slug?: string }
  if (!org_id || !addon_slug) {
    return NextResponse.json({ error: '"org_id" and "addon_slug" are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.schema("billing").rpc("subscribe_org_to_addon", {
    p_org_id: org_id,
    p_addon_slug: addon_slug,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const auth = await requireSuperadmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 403 })
  }

  const url = new URL(request.url)
  const org_id = url.searchParams.get("org_id")
  const addon_slug = url.searchParams.get("addon_slug")
  if (!org_id || !addon_slug) {
    return NextResponse.json({ error: '"org_id" and "addon_slug" query params are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.schema("billing").rpc("cancel_org_addon", {
    p_org_id: org_id,
    p_addon_slug: addon_slug,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse(null, { status: 204 })
}
