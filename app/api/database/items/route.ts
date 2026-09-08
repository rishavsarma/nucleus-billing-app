import { NextResponse } from "next/server"
import { pickAllowed } from "@/lib/database/allowed-fields"
import {
  authError,
  badRequest,
  dbError,
  notFound,
  readJson,
} from "@/lib/api-response"
import { applyListParams, isRangeError } from "@/lib/database/list-params"
import { requireOrgId } from "@/lib/database/require-org"
import {
  cacheBumpListVersion,
  cacheDel,
  cacheGet,
  cacheGetListVersion,
  cacheSet,
} from "@/lib/cache"

// Items change moderately often (price/stock edits) but are fetched
// constantly — every invoice/bill creation resolves from here.
const ITEM_CACHE_TTL_SECONDS = 120

function itemCacheKey(orgId: string, id: string) {
  return `item:${orgId}:${id}`
}

// ---------------------------------------------------------------------------
// List cache — version-counter invalidation (same pattern as warehouses).
// One INCR on write orphans every cached list page for the org instantly.
// ---------------------------------------------------------------------------

function itemListCacheKey(
  orgId: string,
  version: number,
  search: string,
  page: number,
  pageSize: number
) {
  return `item-list:${orgId}:v${version}:${search}:${page}:${pageSize}`
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  // Reuse the client returned by requireOrgId — no second createClient() call.
  const supabase = auth.supabase

  if (id) {
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(itemCacheKey(auth.orgId!, id))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let recordQuery = supabase
      .schema("billing")
      .from("items")
      .select("*, tax_rate:tax_rates(name)")
      .eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return dbError(error, "items:GET")
    if (!data) return notFound()

    if (!auth.isSuperadmin) {
      await cacheSet(
        itemCacheKey(auth.orgId!, id),
        JSON.stringify(data),
        ITEM_CACHE_TTL_SECONDS
      )
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await cacheGetListVersion("item", auth.orgId!)
    const listKey = itemListCacheKey(
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
      .from("items")
      // Embeds the tax rate name — avoids a separate full tax_rates fetch on list pages.
      .select("*, tax_rate:tax_rates(name)", { count: "exact" })
      .eq("org_id", auth.orgId)
    query = applyListParams(query, ["name", "sku"], {
      search: search || undefined,
      page,
      pageSize,
    })
    const { data, error, count } = await query

    if (error) {
      if (isRangeError(error)) {
        const body = { data: [], total: count ?? 0 }
        await cacheSet(listKey, JSON.stringify(body), ITEM_CACHE_TTL_SECONDS)
        return NextResponse.json(body)
      }
      return dbError(error, "items:GET")
    }
    const body = { data: data ?? [], total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(body), ITEM_CACHE_TTL_SECONDS)
    return NextResponse.json(body)
  }

  // Superadmin: no cache, sees all orgs.
  let query = supabase
    .schema("billing")
    .from("items")
    .select("*, tax_rate:tax_rates(name)", { count: "exact" })
  query = applyListParams(query, ["name", "sku"], {
    search: search || undefined,
    page,
    pageSize,
  })
  const { data, error, count } = await query

  if (error) {
    if (isRangeError(error))
      return NextResponse.json({ data: [], total: count ?? 0 })
    return dbError(error, "items:GET")
  }
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
    .from("items")
    .insert({ ...pickAllowed("items", body), org_id: orgId })
    .select()
    .single()

  if (error) return dbError(error, "items:POST")
  void cacheBumpListVersion("item", orgId)
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
    .from("items")
    .update(pickAllowed("items", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "items:PUT")
  if (!data) return notFound()

  await cacheDel(itemCacheKey(data.org_id, id))
  void cacheBumpListVersion("item", data.org_id)
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
    .from("items")
    .delete()
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select("org_id").maybeSingle()

  if (error) return dbError(error, "items:DELETE")
  if (data) {
    await cacheDel(itemCacheKey(data.org_id, id))
    void cacheBumpListVersion("item", data.org_id)
  }
  return new NextResponse(null, { status: 204 })
}
