import { NextResponse } from "next/server"
import { requireOrgId, type SupabaseClient } from "@/lib/database/require-org"
import { cacheGet, cacheSet } from "@/lib/cache"
import { redis } from "@/lib/redis"

const STOCK_CACHE_TTL_SECONDS = 60

function singleStockCacheKey(orgId: string, itemId: string) {
  return `item-stock:single:${orgId}:${itemId}`
}

async function getListVersion(orgId: string): Promise<number> {
  try {
    const v = await redis.get(`item-stock-list-version:${orgId}`)
    return v ? parseInt(v, 10) : 0
  } catch {
    return 0
  }
}

function stockListCacheKey(
  orgId: string,
  version: number,
  search: string,
  page: number,
  pageSize: number,
) {
  return `item-stock-list:${orgId}:v${version}:${search}:${page}:${pageSize}`
}

async function verifyItemInOrg(
  supabase: SupabaseClient,
  itemId: string,
  orgId: string | null,
  isSuperadmin: boolean,
) {
  let query = supabase.schema("billing").from("items").select("id").eq("id", itemId)
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

  const { searchParams } = new URL(request.url)
  const itemId = searchParams.get("item_id")
  const supabase = auth.supabase

  if (itemId) {
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(singleStockCacheKey(auth.orgId!, itemId))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    const { ok, error: verifyError } = await verifyItemInOrg(
      supabase,
      itemId,
      auth.orgId,
      auth.isSuperadmin,
    )
    if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data, error } = await supabase
      .schema("billing")
      .from("item_stock")
      .select("*")
      .eq("item_id", itemId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!auth.isSuperadmin) {
      await cacheSet(singleStockCacheKey(auth.orgId!, itemId), JSON.stringify(data ?? []), STOCK_CACHE_TTL_SECONDS)
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search")?.trim() ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await getListVersion(auth.orgId!)
    const listKey = stockListCacheKey(auth.orgId!, version, search, page, pageSize)
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    let query = supabase
      .schema("billing")
      .from("item_stock")
      .select(
        "item_id, warehouse_id, quantity_on_hand, items!inner(name, sku, reorder_level, org_id), warehouses(name)",
        { count: "exact" },
      )
      .eq("items.org_id", auth.orgId!)

    if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`, { foreignTable: "items" })
    query = query.order("name", { foreignTable: "items", ascending: true })

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? []).map((row) => {
      const item = Array.isArray(row.items) ? row.items[0] : row.items
      const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses
      return {
        item_id: row.item_id,
        warehouse_id: row.warehouse_id,
        quantity_on_hand: row.quantity_on_hand,
        item_name: item?.name ?? "—",
        item_sku: item?.sku ?? null,
        item_reorder_level: item?.reorder_level ?? 0,
        warehouse_name: warehouse?.name ?? "—",
      }
    })

    const payload = { data: rows, total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(payload), STOCK_CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  }

  let query = supabase
    .schema("billing")
    .from("item_stock")
    .select(
      "item_id, warehouse_id, quantity_on_hand, items!inner(name, sku, reorder_level, org_id), warehouses(name)",
      { count: "exact" },
    )

  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`, { foreignTable: "items" })
  query = query.order("name", { foreignTable: "items", ascending: true })

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((row) => {
    const item = Array.isArray(row.items) ? row.items[0] : row.items
    const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses
    return {
      item_id: row.item_id,
      warehouse_id: row.warehouse_id,
      quantity_on_hand: row.quantity_on_hand,
      item_name: item?.name ?? "—",
      item_sku: item?.sku ?? null,
      item_reorder_level: item?.reorder_level ?? 0,
      warehouse_name: warehouse?.name ?? "—",
    }
  })

  return NextResponse.json({ data: rows, total: count ?? 0 })
}
