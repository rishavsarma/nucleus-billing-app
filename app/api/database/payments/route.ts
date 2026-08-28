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
  const invoiceId = searchParams.get("invoice_id")
  const supabase = auth.supabase

  // Scoped to one invoice — used by the invoice detail page's payment
  // history. Was previously fetched via the "all payments" endpoint
  // (pageSize: 9999, every payment in the org) and filtered client-side to
  // this one invoice_id — that scaled with total org payment volume on
  // every single invoice view, not just list views. This scopes the query
  // itself instead.
  if (invoiceId) {
    let query = supabase
      .schema("billing")
      .from("payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("paid_at", { ascending: false })
    if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId!)
    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? undefined
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  // Embeds the invoice number and (nested one level further) the customer
  // name via invoice_id — avoids the list page separately fetching every
  // invoice and every customer (pageSize: 9999 each) to resolve these.
  let query = supabase
    .schema("billing")
    .from("payments")
    .select("*, invoice:invoices(invoice_number, customer:customers(name))", { count: "exact" })
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  query = applyListParams(query, ["reference"], { search, page, pageSize })
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
  if (!body.invoice_id) {
    return NextResponse.json({ error: '"invoice_id" is required' }, { status: 400 })
  }

  const supabase = auth.supabase
  if (!(await verifyBelongsToOrg(supabase, "invoices", body.invoice_id, orgId, auth.isSuperadmin))) {
    return NextResponse.json({ error: "invoice_id does not belong to this org" }, { status: 400 })
  }
  if (
    body.installment_id &&
    !(await verifyBelongsToOrg(supabase, "installments", body.installment_id, orgId, auth.isSuperadmin))
  ) {
    return NextResponse.json({ error: "installment_id does not belong to this org" }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("payments")
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
  let query = supabase.schema("billing").from("payments").update(body).eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(data)
}

// No DELETE: payments are financial records and are never hard-deleted.
// No delete policy exists for this table.
