import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireOrgId } from "@/lib/billing/require-org"

async function verifyItemInOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

  const itemId = new URL(request.url).searchParams.get("item_id")
  if (!itemId) {
    return NextResponse.json({ error: 'Query param "item_id" is required' }, { status: 400 })
  }

  const supabase = await createClient()
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

// No POST/PUT/DELETE: item_stock is read-only from the API (see
// rls-policies.sql, which grants only item_stock_select — no write policy
// exists for this table). All writes happen via the
// billing.stock_movements_apply() trigger, driven by POST
// /api/billing/stock_movements.
