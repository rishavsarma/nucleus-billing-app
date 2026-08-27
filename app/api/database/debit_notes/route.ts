import { NextResponse } from "next/server"
import { applyListParams } from "@/lib/database/list-params"
import { createClient } from "@/lib/supabase/server"
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"

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

  const supabase = await createClient()

  // A single-record fetch — used by detail pages instead of pulling every
  // row via the paginated branch below and finding it client-side.
  if (id) {
    let recordQuery = supabase.schema("billing").from("debit_notes").select("*").eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? undefined
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  let query = supabase.schema("billing").from("debit_notes").select("*", { count: "exact" })
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  query = applyListParams(query, ["debit_note_number"], { search, page, pageSize })
  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const body = await request.json()
  const orgId = auth.isSuperadmin ? body.org_id : auth.orgId
  if (!orgId) {
    return NextResponse.json({ error: '"org_id" is required' }, { status: 400 })
  }
  if (!body.purchase_bill_id || !body.vendor_id) {
    return NextResponse.json(
      { error: '"purchase_bill_id" and "vendor_id" are required' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  if (
    !(await verifyBelongsToOrg(
      supabase,
      "purchase_bills",
      body.purchase_bill_id,
      orgId,
      auth.isSuperadmin,
    ))
  ) {
    return NextResponse.json(
      { error: "purchase_bill_id does not belong to this org" },
      { status: 400 },
    )
  }
  if (!(await verifyBelongsToOrg(supabase, "vendors", body.vendor_id, orgId, auth.isSuperadmin))) {
    return NextResponse.json({ error: "vendor_id does not belong to this org" }, { status: 400 })
  }
  if (
    body.warehouse_id &&
    !(await verifyBelongsToOrg(supabase, "warehouses", body.warehouse_id, orgId, auth.isSuperadmin))
  ) {
    return NextResponse.json({ error: "warehouse_id does not belong to this org" }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("debit_notes")
    .insert({ ...body, org_id: orgId, created_by: auth.userId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: 'Query param "id" is required' }, { status: 400 })
  }

  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const body = await request.json()
  const supabase = await createClient()
  let query = supabase.schema("billing").from("debit_notes").update(body).eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(data)
}

// No DELETE: debit notes are financial records — cancel via status =
// 'void', never hard-deleted. No delete policy exists for this table.
