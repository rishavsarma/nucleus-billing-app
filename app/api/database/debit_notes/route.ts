import { NextResponse } from "next/server"
import { applyListParams } from "@/lib/database/list-params"
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

  const supabase = auth.supabase

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

  // Embeds the vendor's name via vendor_id — avoids the list page
  // separately fetching every vendor (pageSize: 9999) to resolve it.
  let query = supabase.schema("billing").from("debit_notes").select("*, vendor:vendors(name)", { count: "exact" })
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  query = applyListParams(query, ["debit_note_number"], { search, page, pageSize })
  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

// Debit notes are pure value adjustments now — no item_id/quantity/
// warehouse_id, no inventory trigger. purchase_bill_id is optional context
// (a debit doesn't have to reference a purchase at all), so it's only
// verified when actually provided.
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
  if (!body.vendor_id) {
    return NextResponse.json({ error: '"vendor_id" is required' }, { status: 400 })
  }

  const supabase = auth.supabase
  if (!(await verifyBelongsToOrg(supabase, "vendors", body.vendor_id, orgId, auth.isSuperadmin))) {
    return NextResponse.json({ error: "vendor_id does not belong to this org" }, { status: 400 })
  }
  if (
    body.purchase_bill_id &&
    !(await verifyBelongsToOrg(supabase, "purchase_bills", body.purchase_bill_id, orgId, auth.isSuperadmin))
  ) {
    return NextResponse.json({ error: "purchase_bill_id does not belong to this org" }, { status: 400 })
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
  const supabase = auth.supabase
  let query = supabase.schema("billing").from("debit_notes").update(body).eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(data)
}

// No DELETE: debit notes are financial records — cancel via status =
// 'void', never hard-deleted. No delete policy exists for this table.
