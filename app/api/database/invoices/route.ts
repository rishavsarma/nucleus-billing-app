import { NextResponse } from "next/server"
import { applyListParams, isRangeError } from "@/lib/database/list-params"
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"
import { redis } from "@/lib/redis"

const INVOICE_CACHE_TTL_SECONDS = 60

function invoiceCacheKey(orgId: string, id: string) {
  return `invoice:${orgId}:${id}`
}

async function getListVersion(orgId: string): Promise<number> {
  try {
    const v = await redis.get(`invoice-list-version:${orgId}`)
    return v ? parseInt(v, 10) : 0
  } catch {
    return 0
  }
}

async function bumpListVersion(orgId: string): Promise<void> {
  try {
    await redis.incr(`invoice-list-version:${orgId}`)
  } catch {
    // swallow
  }
}

function invoiceListCacheKey(
  orgId: string,
  version: number,
  customerId: string,
  search: string,
  page: number,
  pageSize: number,
) {
  return `invoice-list:${orgId}:v${version}:${customerId}:${search}:${page}:${pageSize}`
}

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

  if (id) {
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(invoiceCacheKey(auth.orgId!, id))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let recordQuery = supabase.schema("billing").from("invoices").select("*").eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (!auth.isSuperadmin) {
      await cacheSet(invoiceCacheKey(auth.orgId!, id), JSON.stringify(data), INVOICE_CACHE_TTL_SECONDS)
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)
  const customerId = searchParams.get("customer_id") ?? ""

  if (!auth.isSuperadmin) {
    const version = await getListVersion(auth.orgId!)
    const listKey = invoiceListCacheKey(auth.orgId!, version, customerId, search, page, pageSize)
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    let query = supabase.schema("billing").from("invoices").select("*, customer:customers(name)", { count: "exact" })
    query = query.eq("org_id", auth.orgId)
    if (customerId) query = query.eq("customer_id", customerId)
    query = applyListParams(query, ["invoice_number"], { search: search || undefined, page, pageSize })
    const { data, error, count } = await query

    if (error) {
      if (isRangeError(error)) {
        const emptyPayload = { data: [], total: count ?? 0 }
        await cacheSet(listKey, JSON.stringify(emptyPayload), INVOICE_CACHE_TTL_SECONDS)
        return NextResponse.json(emptyPayload)
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(payload), INVOICE_CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  }

  let query = supabase.schema("billing").from("invoices").select("*, customer:customers(name)", { count: "exact" })
  if (customerId) query = query.eq("customer_id", customerId)
  query = applyListParams(query, ["invoice_number"], { search: search || undefined, page, pageSize })
  const { data, error, count } = await query

  if (error) {
    if (isRangeError(error)) return NextResponse.json({ data: [], total: count ?? 0 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
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
  if (!body.customer_id) {
    return NextResponse.json({ error: '"customer_id" is required' }, { status: 400 })
  }

  const supabase = auth.supabase
  const [custOk, whOk, offOk] = await Promise.all([
    verifyBelongsToOrg(supabase, "customers", body.customer_id, orgId, auth.isSuperadmin),
    body.warehouse_id ? verifyBelongsToOrg(supabase, "warehouses", body.warehouse_id, orgId, auth.isSuperadmin) : Promise.resolve(true),
    body.offer_id ? verifyBelongsToOrg(supabase, "offers", body.offer_id, orgId, auth.isSuperadmin) : Promise.resolve(true),
  ])

  if (!custOk) return NextResponse.json({ error: "customer_id does not belong to this org" }, { status: 400 })
  if (!whOk) return NextResponse.json({ error: "warehouse_id does not belong to this org" }, { status: 400 })
  if (!offOk) return NextResponse.json({ error: "offer_id does not belong to this org" }, { status: 400 })

  const { data, error } = await supabase
    .schema("billing")
    .from("invoices")
    .insert({ ...body, org_id: orgId, created_by: auth.userId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  void bumpListVersion(orgId)
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
  let query = supabase.schema("billing").from("invoices").update(body).eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await cacheDel(invoiceCacheKey(data.org_id, id))
  void bumpListVersion(data.org_id)
  return NextResponse.json(data)
}
