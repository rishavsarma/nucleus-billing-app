import { NextResponse } from "next/server"
import { requireOrgId, type SupabaseClient } from "@/lib/database/require-org"

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
  const warehouseId = url.searchParams.get("warehouse_id")
  const supabase = auth.supabase

  // Bulk mode — every requested item's variants in one request, instead of
  // one request per item. item_variants carries its own org_id (unlike
  // item_stock), so this needs no join to items for org-scoping.
  if (itemIdsParam) {
    const itemIds = itemIdsParam.split(",").filter(Boolean)
    if (!itemIds.length) return NextResponse.json([])

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
    return NextResponse.json(data)
  }

  if (!itemId) {
    return NextResponse.json({ error: 'Query param "item_id" or "item_ids" is required' }, { status: 400 })
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
  if (warehouseId) query = query.eq("warehouse_id", warehouseId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// No POST/PUT/DELETE: item_variants is read-only from the API (see
// 006_item_variants.sql, which grants only item_variants_select — no write
// policy exists for this table). All writes happen via the
// *_stock_effect() trigger functions, driven by a purchase bill/invoice/
// credit note/debit note's status actually changing.
