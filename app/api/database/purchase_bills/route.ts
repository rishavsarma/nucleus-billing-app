import { NextResponse } from "next/server"
import { applyListParams, isRangeError } from "@/lib/database/list-params"
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"
import { redis } from "@/lib/redis"

const BILL_CACHE_TTL_SECONDS = 60

function billCacheKey(orgId: string, id: string) {
  return `purchase-bill:${orgId}:${id}`
}

async function getListVersion(orgId: string): Promise<number> {
  try {
    const v = await redis.get(`purchase-bill-list-version:${orgId}`)
    return v ? parseInt(v, 10) : 0
  } catch {
    return 0
  }
}

async function bumpListVersion(orgId: string): Promise<void> {
  try {
    await redis.incr(`purchase-bill-list-version:${orgId}`)
  } catch {
    // swallow
  }
}

function billListCacheKey(
  orgId: string,
  version: number,
  vendorId: string,
  search: string,
  page: number,
  pageSize: number,
) {
  return `purchase-bill-list:${orgId}:v${version}:${vendorId}:${search}:${page}:${pageSize}`
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
      const cached = await cacheGet(billCacheKey(auth.orgId!, id))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let recordQuery = supabase.schema("billing").from("purchase_bills").select("*").eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (!auth.isSuperadmin) {
      await cacheSet(billCacheKey(auth.orgId!, id), JSON.stringify(data), BILL_CACHE_TTL_SECONDS)
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)
  const vendorId = searchParams.get("vendor_id") ?? ""

  if (!auth.isSuperadmin) {
    const version = await getListVersion(auth.orgId!)
    const listKey = billListCacheKey(auth.orgId!, version, vendorId, search, page, pageSize)
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    let query = supabase.schema("billing").from("purchase_bills").select("*, vendor:vendors(name)", { count: "exact" })
    query = query.eq("org_id", auth.orgId)
    if (vendorId) query = query.eq("vendor_id", vendorId)
    query = applyListParams(query, ["bill_number", "vendor_invoice_number"], { search: search || undefined, page, pageSize })
    const { data, error, count } = await query

    if (error) {
      if (isRangeError(error)) {
        const emptyPayload = { data: [], total: count ?? 0 }
        await cacheSet(listKey, JSON.stringify(emptyPayload), BILL_CACHE_TTL_SECONDS)
        return NextResponse.json(emptyPayload)
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(payload), BILL_CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  }

  let query = supabase.schema("billing").from("purchase_bills").select("*, vendor:vendors(name)", { count: "exact" })
  if (vendorId) query = query.eq("vendor_id", vendorId)
  query = applyListParams(query, ["bill_number", "vendor_invoice_number"], { search: search || undefined, page, pageSize })
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
  if (!body.vendor_id) {
    return NextResponse.json({ error: '"vendor_id" is required' }, { status: 400 })
  }

  const supabase = auth.supabase
  const [vendOk, whOk] = await Promise.all([
    verifyBelongsToOrg(supabase, "vendors", body.vendor_id, orgId, auth.isSuperadmin),
    body.warehouse_id ? verifyBelongsToOrg(supabase, "warehouses", body.warehouse_id, orgId, auth.isSuperadmin) : Promise.resolve(true),
  ])

  if (!vendOk) return NextResponse.json({ error: "vendor_id does not belong to this org" }, { status: 400 })
  if (!whOk) return NextResponse.json({ error: "warehouse_id does not belong to this org" }, { status: 400 })

  const { data, error } = await supabase
    .schema("billing")
    .from("purchase_bills")
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
  let query = supabase.schema("billing").from("purchase_bills").update(body).eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await cacheDel(billCacheKey(data.org_id, id))
  void bumpListVersion(data.org_id)
  return NextResponse.json(data)
}
