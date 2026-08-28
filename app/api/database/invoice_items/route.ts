import { NextResponse } from "next/server"
import { requireOrgId, verifyBelongsToOrg, type SupabaseClient } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

const ITEMS_CACHE_TTL_SECONDS = 120

function invoiceItemsCacheKey(orgId: string, invoiceId: string) {
  return `invoice-items:${orgId}:${invoiceId}`
}

async function verifyInvoiceInOrg(
  supabase: SupabaseClient,
  invoiceId: string,
  orgId: string | null,
  isSuperadmin: boolean,
) {
  let query = supabase.schema("billing").from("invoices").select("id").eq("id", invoiceId)
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

  const invoiceId = new URL(request.url).searchParams.get("invoice_id")
  if (!invoiceId) {
    return NextResponse.json(
      { error: 'Query param "invoice_id" is required' },
      { status: 400 },
    )
  }

  if (!auth.isSuperadmin) {
    const cached = await cacheGet(invoiceItemsCacheKey(auth.orgId!, invoiceId))
    if (cached) return NextResponse.json(JSON.parse(cached))
  }

  const supabase = auth.supabase
  const { ok, error: verifyError } = await verifyInvoiceInOrg(
    supabase,
    invoiceId,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await supabase
    .schema("billing")
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!auth.isSuperadmin) {
    await cacheSet(invoiceItemsCacheKey(auth.orgId!, invoiceId), JSON.stringify(data ?? []), ITEMS_CACHE_TTL_SECONDS)
  }

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
  if (!body.invoice_id) {
    return NextResponse.json({ error: '"invoice_id" is required' }, { status: 400 })
  }

  const supabase = auth.supabase
  const [invCheck, itemCheck, variantCheck] = await Promise.all([
    verifyInvoiceInOrg(supabase, body.invoice_id, auth.orgId, auth.isSuperadmin),
    body.item_id ? verifyBelongsToOrg(supabase, "items", body.item_id, auth.orgId, auth.isSuperadmin) : Promise.resolve(true),
    body.item_variant_id ? verifyBelongsToOrg(supabase, "item_variants", body.item_variant_id, auth.orgId, auth.isSuperadmin) : Promise.resolve(true),
  ])

  if (invCheck.error) return NextResponse.json({ error: invCheck.error.message }, { status: 500 })
  if (!invCheck.ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!itemCheck) return NextResponse.json({ error: "item_id does not belong to this org" }, { status: 400 })
  if (!variantCheck) return NextResponse.json({ error: "item_variant_id does not belong to this org" }, { status: 400 })

  const { data, error } = await supabase
    .schema("billing")
    .from("invoice_items")
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (auth.orgId) {
    await Promise.all([
      cacheDel(invoiceItemsCacheKey(auth.orgId, body.invoice_id)),
      cacheDel(`invoice:${auth.orgId}:${body.invoice_id}`),
    ])
  }

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

  const supabase = auth.supabase
  const { data: existing, error: existingError } = await supabase
    .schema("billing")
    .from("invoice_items")
    .select("invoice_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { ok, error: verifyError } = await verifyInvoiceInOrg(
    supabase,
    existing.invoice_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await request.json()
  if (
    body.item_variant_id &&
    !(await verifyBelongsToOrg(supabase, "item_variants", body.item_variant_id, auth.orgId, auth.isSuperadmin))
  ) {
    return NextResponse.json({ error: "item_variant_id does not belong to this org" }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("invoice_items")
    .update(body)
    .eq("id", id)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (auth.orgId) {
    await Promise.all([
      cacheDel(invoiceItemsCacheKey(auth.orgId, existing.invoice_id)),
      cacheDel(`invoice:${auth.orgId}:${existing.invoice_id}`),
    ])
  }

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

  const supabase = auth.supabase
  const { data: existing, error: existingError } = await supabase
    .schema("billing")
    .from("invoice_items")
    .select("invoice_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { ok, error: verifyError } = await verifyInvoiceInOrg(
    supabase,
    existing.invoice_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase.schema("billing").from("invoice_items").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (auth.orgId) {
    await Promise.all([
      cacheDel(invoiceItemsCacheKey(auth.orgId, existing.invoice_id)),
      cacheDel(`invoice:${auth.orgId}:${existing.invoice_id}`),
    ])
  }

  return new NextResponse(null, { status: 204 })
}
