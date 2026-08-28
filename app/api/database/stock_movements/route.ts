import { NextResponse } from "next/server"
import { applyListParams } from "@/lib/database/list-params"
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"
import { redis } from "@/lib/redis"

const MOVEMENTS_CACHE_TTL_SECONDS = 60

async function getListVersion(orgId: string): Promise<number> {
  try {
    const v = await redis.get(`movements-list-version:${orgId}`)
    return v ? parseInt(v, 10) : 0
  } catch {
    return 0
  }
}

async function bumpListVersion(orgId: string): Promise<void> {
  try {
    await redis.incr(`movements-list-version:${orgId}`)
  } catch {
    // swallow
  }
}

function movementsListCacheKey(orgId: string, version: number, search: string, page: number, pageSize: number) {
  return `movements-list:${orgId}:v${version}:${search}:${page}:${pageSize}`
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
  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await getListVersion(auth.orgId!)
    const listKey = movementsListCacheKey(auth.orgId!, version, search, page, pageSize)
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    const supabase = auth.supabase
    let query = supabase
      .schema("billing")
      .from("stock_movements")
      .select("*, item:items(name), warehouse:warehouses(name)", { count: "exact" })
      .eq("org_id", auth.orgId)
    query = applyListParams(query, ["notes"], { search: search || undefined, page, pageSize })
    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(payload), MOVEMENTS_CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  }

  const supabase = auth.supabase
  let query = supabase
    .schema("billing")
    .from("stock_movements")
    .select("*, item:items(name), warehouse:warehouses(name)", { count: "exact" })
  query = applyListParams(query, ["notes"], { search: search || undefined, page, pageSize })
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
  if (!body.item_id || !body.warehouse_id) {
    return NextResponse.json(
      { error: '"item_id" and "warehouse_id" are required' },
      { status: 400 },
    )
  }
  if (body.movement_type && body.movement_type !== "adjustment") {
    return NextResponse.json(
      { error: 'Only movement_type "adjustment" is allowed via the manual adjustment endpoint' },
      { status: 400 },
    )
  }

  const supabase = auth.supabase
  const [itemOk, whOk] = await Promise.all([
    verifyBelongsToOrg(supabase, "items", body.item_id, orgId, auth.isSuperadmin),
    verifyBelongsToOrg(supabase, "warehouses", body.warehouse_id, orgId, auth.isSuperadmin),
  ])

  if (!itemOk) return NextResponse.json({ error: "item_id does not belong to this org" }, { status: 400 })
  if (!whOk) return NextResponse.json({ error: "warehouse_id does not belong to this org" }, { status: 400 })

  const { data, error } = await supabase
    .schema("billing")
    .from("stock_movements")
    .insert({
      ...body,
      org_id: orgId,
      created_by: auth.userId,
      movement_type: "adjustment",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void bumpListVersion(orgId)
  await cacheDel(`item-stock:single:${orgId}:${body.item_id}`)
  return NextResponse.json(data, { status: 201 })
}
