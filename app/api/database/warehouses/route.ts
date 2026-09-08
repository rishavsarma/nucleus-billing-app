import { NextResponse } from "next/server"
import { pickAllowed } from "@/lib/database/allowed-fields"
import {
  authError,
  badRequest,
  dbError,
  notFound,
  readJson,
} from "@/lib/api-response"
import { applyListParams } from "@/lib/database/list-params"
import { requireOrgId } from "@/lib/database/require-org"
import {
  cacheBumpListVersion,
  cacheDel,
  cacheGet,
  cacheGetListVersion,
  cacheSet,
} from "@/lib/cache"

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

// ---------------------------------------------------------------------------
// List cache — version-counter invalidation
// ---------------------------------------------------------------------------
// Caching paginated lists is tricky because the key space (search strings ×
// pages × page sizes) is unbounded. We can't enumerate all keys on a write.
// Solution: store a per-org integer version in Redis. Every list cache key
// embeds the current version, so a single INCR on any write makes every
// previously cached page for that org unreachable — they'll expire naturally
// via TTL without us needing to track or delete them individually.

function warehouseListCacheKey(
  orgId: string,
  version: number,
  search: string,
  page: number,
  pageSize: number
) {
  return `warehouse-list:${orgId}:v${version}:${search}:${page}:${pageSize}`
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  const supabase = auth.supabase

  // A single-record fetch — used by detail pages instead of pulling every
  // row via the paginated branch below and finding it client-side.
  if (id) {
    // Serve non-superadmin single-row reads from Redis when warm.
    // Superadmin reads skip the cache — cross-org access is an admin path,
    // not the hot path this is optimizing for, and it'd need its own
    // (org-agnostic) key scheme to stay safe.
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(warehouseCacheKey(auth.orgId!, id))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let recordQuery = supabase
      .schema("billing")
      .from("warehouses")
      .select("*")
      .eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return dbError(error, "warehouses:GET")
    if (!data) return notFound()

    if (!auth.isSuperadmin) {
      await cacheSet(
        warehouseCacheKey(auth.orgId!, id),
        JSON.stringify(data),
        WAREHOUSE_CACHE_TTL_SECONDS
      )
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  // Cache paginated list results per org. Superadmin reads are skipped
  // (cross-org, low volume, not worth the key complexity).
  if (!auth.isSuperadmin) {
    const version = await cacheGetListVersion("warehouse", auth.orgId!)
    const listKey = warehouseListCacheKey(
      auth.orgId!,
      version,
      search,
      page,
      pageSize
    )
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    let query = supabase
      .schema("billing")
      .from("warehouses")
      .select("*", { count: "exact" })
    query = query.eq("org_id", auth.orgId)
    query = applyListParams(query, ["name"], {
      search: search || undefined,
      page,
      pageSize,
    })
    const { data, error, count } = await query

    if (error) return dbError(error, "warehouses:GET")
    const body = { data: data ?? [], total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(body), WAREHOUSE_CACHE_TTL_SECONDS)
    return NextResponse.json(body)
  }

  // Superadmin: no cache, sees all orgs.
  let query = supabase
    .schema("billing")
    .from("warehouses")
    .select("*", { count: "exact" })
  query = applyListParams(query, ["name"], {
    search: search || undefined,
    page,
    pageSize,
  })
  const { data, error, count } = await query

  if (error) return dbError(error, "warehouses:GET")
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const body = await readJson(request)
  if (!body)
    return badRequest("invalid_json", "Request body must be valid JSON.")
  const orgId = auth.isSuperadmin ? body.org_id : auth.orgId
  if (!orgId) {
    return NextResponse.json({ error: '"org_id" is required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .schema("billing")
    .from("warehouses")
    .insert({ ...pickAllowed("warehouses", body), org_id: orgId })
    .select()
    .single()

  if (error) return dbError(error, "warehouses:POST")
  // Bump list version so all cached list pages for this org are invalidated.
  void cacheBumpListVersion("warehouse", orgId)
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) {
    return NextResponse.json(
      { error: 'Query param "id" is required' },
      { status: 400 }
    )
  }

  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const body = await readJson(request)
  if (!body)
    return badRequest("invalid_json", "Request body must be valid JSON.")
  let query = auth.supabase
    .schema("billing")
    .from("warehouses")
    .update(pickAllowed("warehouses", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "warehouses:PUT")
  if (!data) return notFound()

  // Bust the cached read so the edit shows up immediately instead of
  // waiting out the TTL — keyed off the row's own org_id (not auth.orgId)
  // so this still invalidates correctly when a superadmin is the one
  // editing another org's warehouse.
  await cacheDel(warehouseCacheKey(data.org_id, id))
  // Also bump the list version — the updated row's name/fields may appear
  // in cached list pages which now need refreshing.
  void cacheBumpListVersion("warehouse", data.org_id)
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) {
    return NextResponse.json(
      { error: 'Query param "id" is required' },
      { status: 400 }
    )
  }

  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  let query = auth.supabase
    .schema("billing")
    .from("warehouses")
    .delete()
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  // .select() on the delete returns the deleted row so its org_id is
  // available for cache invalidation below — same reasoning as PUT.
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "warehouses:DELETE")
  if (data) {
    await cacheDel(warehouseCacheKey(data.org_id, id))
    void cacheBumpListVersion("warehouse", data.org_id)
  }
  return new NextResponse(null, { status: 204 })
}
