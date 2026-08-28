import { NextResponse } from "next/server"
import { requireOrgId, type SupabaseClient } from "@/lib/database/require-org"
import { cacheGet, cacheSet } from "@/lib/cache"

const VARIANTS_CACHE_TTL_SECONDS = 60

function variantsBulkCacheKey(orgId: string, itemIdsKey: string, warehouseId: string) {
  return `item-variants:${orgId}:${warehouseId}:${itemIdsKey}`
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

  const url = new URL(request.url)
  const itemId = url.searchParams.get("item_id")
  const itemIdsParam = url.searchParams.get("item_ids")
  const warehouseId = url.searchParams.get("warehouse_id") ?? ""
  const supabase = auth.supabase

  // Bulk mode — every requested item's variants in one request
  if (itemIdsParam) {
    const itemIds = itemIdsParam.split(",").filter(Boolean)
    if (!itemIds.length) return NextResponse.json([])

    const sortedKey = itemIds.slice().sort().join(",")
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(variantsBulkCacheKey(auth.orgId!, sortedKey, warehouseId))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let query = supabase
      .schema("billing")
      .from("item_variants")
      .select("*")
      .in("item_id", itemIds)
      .order("received_at", { ascending: true })
    if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId!)
    if (warehouseId) query = query.eq("warehouse_id", warehouseId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!auth.isSuperadmin) {
      await cacheSet(variantsBulkCacheKey(auth.orgId!, sortedKey, warehouseId), JSON.stringify(data ?? []), VARIANTS_CACHE_TTL_SECONDS)
    }
    return NextResponse.json(data)
  }

  if (!itemId) {
    return NextResponse.json({ error: 'Query param "item_id" or "item_ids" is required' }, { status: 400 })
  }

  if (!auth.isSuperadmin) {
    const cached = await cacheGet(variantsBulkCacheKey(auth.orgId!, itemId, warehouseId))
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

  let query = supabase
    .schema("billing")
    .from("item_variants")
    .select("*")
    .eq("item_id", itemId)
    .order("received_at", { ascending: true })
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId!)
  if (warehouseId) query = query.eq("warehouse_id", warehouseId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!auth.isSuperadmin) {
    await cacheSet(variantsBulkCacheKey(auth.orgId!, itemId, warehouseId), JSON.stringify(data ?? []), VARIANTS_CACHE_TTL_SECONDS)
  }

  return NextResponse.json(data)
}
