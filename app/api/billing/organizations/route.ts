import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireOrgId, requireSuperadmin, requireMemberOf } from "@/lib/billing/require-org"

export async function GET() {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const supabase = await createClient()
  let query = supabase.schema("billing").from("organizations").select("*")
  if (!auth.isSuperadmin) query = query.eq("id", auth.orgId)
  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Organization provisioning is superadmin-only (see organizations_insert in
// rls-policies.sql — an ordinary user has no insert path, even for their own
// org). The superadmin creates the org here, then adds its first member(s)
// via POST /api/billing/memberships.
export async function POST(request: Request) {
  const auth = await requireSuperadmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const body = await request.json()
  const supabase = await createClient()

  const { data: org, error: orgError } = await supabase
    .schema("billing")
    .from("organizations")
    .insert(body)
    .select()
    .single()
  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 })

  return NextResponse.json(org, { status: 201 })
}

export async function PUT(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: 'Query param "id" is required' }, { status: 400 })
  }

  const auth = await requireMemberOf(id)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const body = await request.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("billing")
    .from("organizations")
    .update(body)
    .eq("id", id)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(data)
}

// No DELETE: organizations are never hard-deleted, only deactivated
// (is_active = false via PUT) — see organizations_active_change_guard and
// the "No delete policy" note in rls-policies.sql. There is no delete
// policy for this table at all, so a delete would fail regardless.
