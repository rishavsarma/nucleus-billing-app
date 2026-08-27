import { NextResponse } from "next/server"
import { applyListParams } from "@/lib/database/list-params"
import { createClient } from "@/lib/supabase/server"
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? undefined
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  const supabase = await createClient()
  // Embeds the item name and warehouse name via their FKs — avoids the list
  // page separately fetching every item and every warehouse (pageSize: 9999
  // each) just to resolve these by id.
  let query = supabase
    .schema("billing")
    .from("stock_movements")
    .select("*, item:items(name), warehouse:warehouses(name)", { count: "exact" })
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  query = applyListParams(query, ["notes"], { search, page, pageSize })
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
  // stock_movements_insert (rls-policies.sql) only allows movement_type =
  // 'adjustment' through this client — 'sale'/'purchase'/etc. are written
  // exclusively by the SECURITY DEFINER stock-effect triggers. Reject early
  // with a clear message instead of surfacing a raw RLS-violation error.
  if (body.movement_type && body.movement_type !== "adjustment") {
    return NextResponse.json(
      { error: 'movement_type must be "adjustment" — other types are system-derived' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  if (!(await verifyBelongsToOrg(supabase, "items", body.item_id, orgId, auth.isSuperadmin))) {
    return NextResponse.json({ error: "item_id does not belong to this org" }, { status: 400 })
  }
  if (
    !(await verifyBelongsToOrg(supabase, "warehouses", body.warehouse_id, orgId, auth.isSuperadmin))
  ) {
    return NextResponse.json({ error: "warehouse_id does not belong to this org" }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("stock_movements")
    .insert({ ...body, org_id: orgId, movement_type: "adjustment", created_by: auth.userId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// No PUT/DELETE: stock_movements is an append-only ledger — corrections are
// offsetting rows, never edits (see billing.stock_movements_immutable() in
// functions-trigger.sql, which raises on any update/delete regardless of
// RLS). rls-policies.sql grants only select/insert for this table.
