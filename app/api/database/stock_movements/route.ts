import { NextResponse } from "next/server"
import { authError, badRequest, dbError, readJson } from "@/lib/api-response"
import { pickAllowed } from "@/lib/database/allowed-fields"
import { applyListParams } from "@/lib/database/list-params"
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"
import {
  cacheBumpListVersion,
  cacheDel,
  cacheGet,
  cacheGetListVersion,
  cacheSet,
} from "@/lib/cache"

const MOVEMENTS_CACHE_TTL_SECONDS = 60

function movementsListCacheKey(
  orgId: string,
  version: number,
  search: string,
  page: number,
  pageSize: number
) {
  return `movements-list:${orgId}:v${version}:${search}:${page}:${pageSize}`
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await cacheGetListVersion("movements", auth.orgId!)
    const listKey = movementsListCacheKey(
      auth.orgId!,
      version,
      search,
      page,
      pageSize
    )
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    const supabase = auth.supabase
    let query = supabase
      .schema("billing")
      .from("stock_movements")
      .select("*, item:items(name), warehouse:warehouses(name)", {
        count: "exact",
      })
      .eq("org_id", auth.orgId)
    query = applyListParams(query, ["notes"], {
      search: search || undefined,
      page,
      pageSize,
    })
    const { data, error, count } = await query

    if (error) return dbError(error, "stock_movements:GET")
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(
      listKey,
      JSON.stringify(payload),
      MOVEMENTS_CACHE_TTL_SECONDS
    )
    return NextResponse.json(payload)
  }

  const supabase = auth.supabase
  let query = supabase
    .schema("billing")
    .from("stock_movements")
    .select("*, item:items(name), warehouse:warehouses(name)", {
      count: "exact",
    })
  query = applyListParams(query, ["notes"], {
    search: search || undefined,
    page,
    pageSize,
  })
  const { data, error, count } = await query

  if (error) return dbError(error, "stock_movements:GET")
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
  if (!body.item_id || !body.warehouse_id) {
    return NextResponse.json(
      { error: '"item_id" and "warehouse_id" are required' },
      { status: 400 }
    )
  }
  if (body.movement_type && body.movement_type !== "adjustment") {
    return NextResponse.json(
      {
        error:
          'Only movement_type "adjustment" is allowed via the manual adjustment endpoint',
      },
      { status: 400 }
    )
  }

  const supabase = auth.supabase
  const [itemOk, whOk] = await Promise.all([
    verifyBelongsToOrg(
      supabase,
      "items",
      body.item_id,
      orgId,
      auth.isSuperadmin
    ),
    verifyBelongsToOrg(
      supabase,
      "warehouses",
      body.warehouse_id,
      orgId,
      auth.isSuperadmin
    ),
  ])

  if (!itemOk)
    return NextResponse.json(
      { error: "item_id does not belong to this org" },
      { status: 400 }
    )
  if (!whOk)
    return NextResponse.json(
      { error: "warehouse_id does not belong to this org" },
      { status: 400 }
    )

  const { data, error } = await supabase
    .schema("billing")
    .from("stock_movements")
    .insert({
      ...pickAllowed("stock_movements", body),
      org_id: orgId,
      created_by: auth.userId,
      // Forced, not taken from the body: the real movement types (purchase,
      // sale, *_return and their _void counterparts) are written only by the
      // document status triggers. Same for reference_type/reference_id and
      // the *_item_id columns, which the allow-list drops.
      movement_type: "adjustment",
    })
    .select()
    .single()

  if (error) return dbError(error, "stock_movements:POST")

  void cacheBumpListVersion("movements", orgId)
  await cacheDel(`item-stock:single:${orgId}:${body.item_id}`)
  return NextResponse.json(data, { status: 201 })
}
