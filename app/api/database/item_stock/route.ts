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

  const { searchParams } = new URL(request.url)
  const itemId = searchParams.get("item_id")
  const supabase = auth.supabase

  // Single item's stock across warehouses — used by the "current quantity on
  // hand" preview when recording a manual adjustment.
  if (itemId) {
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
    return NextResponse.json(data)
  }

  // Paginated + searched list — used by the Stock page. item_stock has
  // neither an org_id nor a name column of its own, so org-scoping and name
  // search both go through an inner join on items rather than an N+1 of one
  // item_stock lookup per item.
  const search = searchParams.get("search")?.trim()
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  // Embeds both the item's fields (already joined here) and now the
  // warehouse's name too — avoids the list page separately fetching every
  // warehouse (pageSize: 9999) just to resolve warehouse_id to a name.
  let query = supabase
    .schema("billing")
    .from("item_stock")
    .select(
      "item_id, warehouse_id, quantity_on_hand, items!inner(name, sku, reorder_level, org_id), warehouses(name)",
      { count: "exact" },
    )

  if (!auth.isSuperadmin) query = query.eq("items.org_id", auth.orgId!)
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

// No POST/PUT/DELETE: item_stock is read-only from the API (see
// rls-policies.sql, which grants only item_stock_select — no write policy
// exists for this table). All writes happen via the
// billing.stock_movements_apply() trigger, driven by POST
// /api/database/stock_movements.
