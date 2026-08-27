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
  const id = searchParams.get("id")
  const invoiceId = searchParams.get("invoice_id")
  if (!id && !invoiceId) {
    return NextResponse.json(
      { error: 'Query param "id" or "invoice_id" is required' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  let query = supabase.schema("billing").from("deliveries").select("*")
  query = id ? query.eq("id", id) : query.eq("invoice_id", invoiceId!)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
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

  const supabase = await createClient()
  if (!(await verifyBelongsToOrg(supabase, "invoices", body.invoice_id, orgId, auth.isSuperadmin))) {
    return NextResponse.json({ error: "invoice_id does not belong to this org" }, { status: 400 })
  }
  if (
    body.delivery_person_id &&
    !(await verifyBelongsToOrg(supabase, "staff", body.delivery_person_id, orgId, auth.isSuperadmin))
  ) {
    return NextResponse.json({ error: "delivery_person_id does not belong to this org" }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("deliveries")
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
  if (
    body.delivery_person_id &&
    !(await verifyBelongsToOrg(supabase, "staff", body.delivery_person_id, auth.orgId, auth.isSuperadmin))
  ) {
    return NextResponse.json({ error: "delivery_person_id does not belong to this org" }, { status: 400 })
  }

  let query = supabase.schema("billing").from("deliveries").update(body).eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
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

  const supabase = await createClient()
  let query = supabase.schema("billing").from("deliveries").delete().eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
