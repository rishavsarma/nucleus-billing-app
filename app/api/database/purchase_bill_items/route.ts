import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"

async function verifyPurchaseBillInOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  purchaseBillId: string,
  orgId: string | null,
  isSuperadmin: boolean,
) {
  let query = supabase.schema("billing").from("purchase_bills").select("id").eq("id", purchaseBillId)
  if (!isSuperadmin) query = query.eq("org_id", orgId!)
  const { data, error } = await query.maybeSingle()
  return { ok: !error && !!data, error }
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const purchaseBillId = new URL(request.url).searchParams.get("purchase_bill_id")
  if (!purchaseBillId) {
    return NextResponse.json(
      { error: 'Query param "purchase_bill_id" is required' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { ok, error: verifyError } = await verifyPurchaseBillInOrg(
    supabase,
    purchaseBillId,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await supabase
    .schema("billing")
    .from("purchase_bill_items")
    .select("*")
    .eq("purchase_bill_id", purchaseBillId)

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
  if (!body.purchase_bill_id) {
    return NextResponse.json({ error: '"purchase_bill_id" is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { ok, error: verifyError } = await verifyPurchaseBillInOrg(
    supabase,
    body.purchase_bill_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (
    body.item_id &&
    !(await verifyBelongsToOrg(supabase, "items", body.item_id, auth.orgId, auth.isSuperadmin))
  ) {
    return NextResponse.json({ error: "item_id does not belong to this org" }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("purchase_bill_items")
    .insert(body)
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

  const supabase = await createClient()
  const { data: existing, error: existingError } = await supabase
    .schema("billing")
    .from("purchase_bill_items")
    .select("purchase_bill_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { ok, error: verifyError } = await verifyPurchaseBillInOrg(
    supabase,
    existing.purchase_bill_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await request.json()
  const { data, error } = await supabase
    .schema("billing")
    .from("purchase_bill_items")
    .update(body)
    .eq("id", id)
    .select()
    .maybeSingle()

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
  const { data: existing, error: existingError } = await supabase
    .schema("billing")
    .from("purchase_bill_items")
    .select("purchase_bill_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { ok, error: verifyError } = await verifyPurchaseBillInOrg(
    supabase,
    existing.purchase_bill_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase
    .schema("billing")
    .from("purchase_bill_items")
    .delete()
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
