import { NextResponse } from "next/server"
import { requireOrgId, verifyBelongsToOrg, type SupabaseClient } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

const RETURN_ITEMS_CACHE_TTL_SECONDS = 120

function salesReturnItemsCacheKey(orgId: string, salesReturnId: string) {
  return `sales-return-items:${orgId}:${salesReturnId}`
}

async function verifySalesReturnInOrg(
  supabase: SupabaseClient,
  salesReturnId: string,
  orgId: string | null,
  isSuperadmin: boolean,
) {
  let query = supabase.schema("billing").from("sales_returns").select("id").eq("id", salesReturnId)
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

  const salesReturnId = new URL(request.url).searchParams.get("sales_return_id")
  if (!salesReturnId) {
    return NextResponse.json(
      { error: 'Query param "sales_return_id" is required' },
      { status: 400 },
    )
  }

  if (!auth.isSuperadmin) {
    const cached = await cacheGet(salesReturnItemsCacheKey(auth.orgId!, salesReturnId))
    if (cached) return NextResponse.json(JSON.parse(cached))
  }

  const supabase = auth.supabase
  const { ok, error: verifyError } = await verifySalesReturnInOrg(
    supabase,
    salesReturnId,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await supabase
    .schema("billing")
    .from("sales_return_items")
    .select("*")
    .eq("sales_return_id", salesReturnId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!auth.isSuperadmin) {
    await cacheSet(salesReturnItemsCacheKey(auth.orgId!, salesReturnId), JSON.stringify(data ?? []), RETURN_ITEMS_CACHE_TTL_SECONDS)
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
  if (!body.sales_return_id) {
    return NextResponse.json({ error: '"sales_return_id" is required' }, { status: 400 })
  }

  const supabase = auth.supabase
  const [retCheck, itemCheck] = await Promise.all([
    verifySalesReturnInOrg(supabase, body.sales_return_id, auth.orgId, auth.isSuperadmin),
    body.item_id ? verifyBelongsToOrg(supabase, "items", body.item_id, auth.orgId, auth.isSuperadmin) : Promise.resolve(true),
  ])

  if (retCheck.error) return NextResponse.json({ error: retCheck.error.message }, { status: 500 })
  if (!retCheck.ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!itemCheck) return NextResponse.json({ error: "item_id does not belong to this org" }, { status: 400 })

  const { data, error } = await supabase
    .schema("billing")
    .from("sales_return_items")
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (auth.orgId) {
    await Promise.all([
      cacheDel(salesReturnItemsCacheKey(auth.orgId, body.sales_return_id)),
      cacheDel(`sales-return:${auth.orgId}:${body.sales_return_id}`),
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
    .from("sales_return_items")
    .select("sales_return_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { ok, error: verifyError } = await verifySalesReturnInOrg(
    supabase,
    existing.sales_return_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await request.json()
  const { data, error } = await supabase
    .schema("billing")
    .from("sales_return_items")
    .update(body)
    .eq("id", id)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (auth.orgId) {
    await Promise.all([
      cacheDel(salesReturnItemsCacheKey(auth.orgId, existing.sales_return_id)),
      cacheDel(`sales-return:${auth.orgId}:${existing.sales_return_id}`),
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
    .from("sales_return_items")
    .select("sales_return_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { ok, error: verifyError } = await verifySalesReturnInOrg(
    supabase,
    existing.sales_return_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase.schema("billing").from("sales_return_items").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (auth.orgId) {
    await Promise.all([
      cacheDel(salesReturnItemsCacheKey(auth.orgId, existing.sales_return_id)),
      cacheDel(`sales-return:${auth.orgId}:${existing.sales_return_id}`),
    ])
  }

  return new NextResponse(null, { status: 204 })
}
