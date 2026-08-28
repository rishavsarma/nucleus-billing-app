import { NextResponse } from "next/server"
import { applyListParams } from "@/lib/database/list-params"
import { requireOrgId, requireSuperadmin, requireMemberOf } from "@/lib/database/require-org"

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const supabase = auth.supabase

  // Single org — either an explicit lookup (id given; the superadmin admin
  // org-detail page) or, for a non-superadmin caller with no id, always
  // their own org (a non-superadmin never has any other org to fetch).
  if (id || !auth.isSuperadmin) {
    const query = supabase.schema("billing").from("organizations").select("*").eq("id", id ?? auth.orgId!)
    const { data, error } = await query.maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(data)
  }

  // Paginated list — superadmin only in practice (a non-superadmin caller
  // is always short-circuited above to their own single org), for the
  // Admin > All Organizations list page.
  const search = searchParams.get("search") ?? undefined
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  let query = supabase.schema("billing").from("organizations").select("*", { count: "exact" })
  query = applyListParams(query, ["name"], { search, page, pageSize })
  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

// Organization provisioning is superadmin-only (see organizations_insert in
// rls-policies.sql — an ordinary user has no insert path, even for their own
// org). The superadmin creates the org here, then adds its first member(s)
// via POST /api/database/memberships.
export async function POST(request: Request) {
  const auth = await requireSuperadmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 403 })
  }

  const body = await request.json()
  const supabase = auth.supabase

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

  // is_active/subscription_status are already DB-trigger-guarded to
  // superadmin-only (organizations_active_change_guard /
  // organizations_subscription_change_guard in 002_functions_triggers.sql)
  // — this is defense-in-depth so a non-superadmin gets a clear 403 instead
  // of relying solely on the trigger's exception.
  if ("is_active" in body || "subscription_status" in body) {
    if (!auth.isSuperadmin) {
      return NextResponse.json({ error: "Only a superadmin can change is_active or subscription_status" }, { status: 403 })
    }
  }

  const supabase = auth.supabase
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
