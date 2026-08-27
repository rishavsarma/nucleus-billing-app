import { NextResponse } from "next/server"
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
  const planId = searchParams.get("plan_id")
  const supabase = await createClient()

  // Scoped to one plan — used by the invoice detail page's EMI schedule.
  if (planId) {
    let query = supabase
      .schema("billing")
      .from("installments")
      .select("*")
      .eq("plan_id", planId)
      .order("installment_number", { ascending: true })
    if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId!)
    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Paginated list, org-wide — every installment due, for the Installments
  // page (the calendar-style "what's due" view the EMI feature calls for).
  // No search: installments have no text column of their own worth
  // searching (due_date/amount aren't meaningfully ilike-able), so this
  // page skips the search box rather than faking one.
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Embeds the invoice number via invoice_id — avoids the list page
  // separately fetching every invoice (pageSize: 9999) to resolve it.
  let query = supabase
    .schema("billing")
    .from("installments")
    .select("*, invoice:invoices(invoice_number)", { count: "exact" })
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  query = query.order("due_date", { ascending: true }).range(from, to)
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
  if (!body.plan_id) {
    return NextResponse.json({ error: '"plan_id" is required' }, { status: 400 })
  }
  if (!body.invoice_id) {
    return NextResponse.json({ error: '"invoice_id" is required' }, { status: 400 })
  }

  const supabase = await createClient()
  if (!(await verifyBelongsToOrg(supabase, "installment_plans", body.plan_id, orgId, auth.isSuperadmin))) {
    return NextResponse.json({ error: "plan_id does not belong to this org" }, { status: 400 })
  }
  if (!(await verifyBelongsToOrg(supabase, "invoices", body.invoice_id, orgId, auth.isSuperadmin))) {
    return NextResponse.json({ error: "invoice_id does not belong to this org" }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("installments")
    .insert({ ...body, org_id: orgId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// No PUT/DELETE: an installment's status is only ever changed by the
// payments_mark_installment_paid trigger (see 008_emi_installments.sql),
// driven by recording a payment against it — never written directly.
