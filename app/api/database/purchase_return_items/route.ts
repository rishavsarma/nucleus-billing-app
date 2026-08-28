import { NextResponse } from "next/server"
import { requireOrgId, verifyBelongsToOrg, type SupabaseClient } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

const RETURN_ITEMS_CACHE_TTL_SECONDS = 120

function purchaseReturnItemsCacheKey(orgId: string, purchaseReturnId: string) {
  return `purchase-return-items:${orgId}:${purchaseReturnId}`
}

async function verifyPurchaseReturnInOrg(
  supabase: SupabaseClient,
  purchaseReturnId: string,
  orgId: string | null,
  isSuperadmin: boolean,
) {
  let query = supabase.schema("billing").from("purchase_returns").select("id").eq("id", purchaseReturnId)
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

  const purchaseReturnId = new URL(request.url).searchParams.get("purchase_return_id")
  if (!purchaseReturnId) {
    return NextResponse.json(
      { error: 'Query param "purchase_return_id" is required' },
      { status: 400 },
    )
  }

  if (!auth.isSuperadmin) {
    const cached = await cacheGet(purchaseReturnItemsCacheKey(auth.orgId!, purchaseReturnId))
    if (cached) return NextResponse.json(JSON.parse(cached))
  }

  const supabase = auth.supabase
  const { ok, error: verifyError } = await verifyPurchaseReturnInOrg(
    supabase,
    purchaseReturnId,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await supabase
    .schema("billing")
    .from("purchase_return_items")
    .select("*")
    .eq("purchase_return_id", purchaseReturnId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!auth.isSuperadmin) {
    await cacheSet(purchaseReturnItemsCacheKey(auth.orgId!, purchaseReturnId), JSON.stringify(data ?? []), RETURN_ITEMS_CACHE_TTL_SECONDS)
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
  if (!body.purchase_return_id) {
    return NextResponse.json({ error: '"purchase_return_id" is required' }, { status: 400 })
  }

  const supabase = auth.supabase
  const [retCheck, itemCheck] = await Promise.all([
    verifyPurchaseReturnInOrg(supabase, body.purchase_return_id, auth.orgId, auth.isSuperadmin),
    body.item_id ? verifyBelongsToOrg(supabase, "items", body.item_id, auth.orgId, auth.isSuperadmin) : Promise.resolve(true),
  ])

  if (retCheck.error) return NextResponse.json({ error: retCheck.error.message }, { status: 500 })
  if (!retCheck.ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!itemCheck) return NextResponse.json({ error: "item_id does not belong to this org" }, { status: 400 })

  const { data, error } = await supabase
    .schema("billing")
    .from("purchase_return_items")
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (auth.orgId) {
    await Promise.all([
      cacheDel(purchaseReturnItemsCacheKey(auth.orgId, body.purchase_return_id)),
      cacheDel(`purchase-return:${auth.orgId}:${body.purchase_return_id}`),
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
    .from("purchase_return_items")
    .select("purchase_return_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { ok, error: verifyError } = await verifyPurchaseReturnInOrg(
    supabase,
    existing.purchase_return_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await request.json()
  const { data, error } = await supabase
    .schema("billing")
    .from("purchase_return_items")
    .update(body)
    .eq("id", id)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (auth.orgId) {
    await Promise.all([
      cacheDel(purchaseReturnItemsCacheKey(auth.orgId, existing.purchase_return_id)),
      cacheDel(`purchase-return:${auth.orgId}:${existing.purchase_return_id}`),
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
    .from("purchase_return_items")
    .select("purchase_return_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { ok, error: verifyError } = await verifyPurchaseReturnInOrg(
    supabase,
    existing.purchase_return_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase.schema("billing").from("purchase_return_items").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (auth.orgId) {
    await Promise.all([
      cacheDel(purchaseReturnItemsCacheKey(auth.orgId, existing.purchase_return_id)),
      cacheDel(`purchase-return:${auth.orgId}:${existing.purchase_return_id}`),
    ])
  }

  return new NextResponse(null, { status: 204 })
}
