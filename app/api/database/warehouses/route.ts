import { NextResponse } from "next/server"
import { applyListParams } from "@/lib/database/list-params"
import { createClient } from "@/lib/supabase/server"
import { requireOrgId } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

// Warehouses change rarely (an org adds/edits a location every so often)
// but get resolved by id constantly — every invoice/bill/delivery display
// that references one hits this. Worth caching; the paginated list/search
// branch below isn't, since its key space (arbitrary search strings) has
// no clean way to invalidate on a write.
const WAREHOUSE_CACHE_TTL_SECONDS = 300

// Keyed by org_id, not just id — a cache hit can never leak another
// tenant's warehouse even if two orgs' UUIDs were ever guessed/confused.
function warehouseCacheKey(orgId: string, id: string) {
  return `warehouse:${orgId}:${id}`
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

  const supabase = await createClient()

  // A single-record fetch — used by detail pages instead of pulling every
  // row via the paginated branch below and finding it client-side.
  if (id) {
    // Superadmin reads skip the cache — cross-org access is an admin path,
    // not the hot path this is optimizing for, and it'd need its own
    // (org-agnostic) key scheme to stay safe.
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(warehouseCacheKey(auth.orgId!, id))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let recordQuery = supabase.schema("billing").from("warehouses").select("*").eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (!auth.isSuperadmin) {
      await cacheSet(warehouseCacheKey(auth.orgId!, id), JSON.stringify(data), WAREHOUSE_CACHE_TTL_SECONDS)
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? undefined
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  let query = supabase.schema("billing").from("warehouses").select("*", { count: "exact" })
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  query = applyListParams(query, ["name"], { search, page, pageSize })
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

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("billing")
    .from("warehouses")
    .insert({ ...body, org_id: orgId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
  const supabase = await createClient()
  let query = supabase.schema("billing").from("warehouses").update(body).eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Bust the cached read so the edit shows up immediately instead of
  // waiting out the TTL — keyed off the row's own org_id (not auth.orgId)
  // so this still invalidates correctly when a superadmin is the one
  // editing another org's warehouse.
  await cacheDel(warehouseCacheKey(data.org_id, id))
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

  const supabase = await createClient()
  let query = supabase.schema("billing").from("warehouses").delete().eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  // .select() on the delete returns the deleted row so its org_id is
  // available for cache invalidation below — same reasoning as PUT.
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data) await cacheDel(warehouseCacheKey(data.org_id, id))
  return new NextResponse(null, { status: 204 })
}
