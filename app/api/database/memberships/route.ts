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
  cacheGet,
  cacheGetListVersion,
  cacheSet,
} from "@/lib/cache"

const MEMBERSHIP_CACHE_TTL_SECONDS = 180

function membershipListCacheKey(
  orgId: string,
  version: number,
  page: number,
  pageSize: number
) {
  return `memberships-list:${orgId}:v${version}:${page}:${pageSize}`
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? undefined
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await cacheGetListVersion("memberships", auth.orgId!)
    const listKey = membershipListCacheKey(auth.orgId!, version, page, pageSize)
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    const supabase = auth.supabase
    let query = supabase
      .schema("billing")
      .from("memberships")
      .select("*", { count: "exact" })
      .eq("org_id", auth.orgId)
    query = applyListParams(query, [], { search, page, pageSize })
    const { data, error, count } = await query

    if (error) return dbError(error, "memberships:GET")
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(
      listKey,
      JSON.stringify(payload),
      MEMBERSHIP_CACHE_TTL_SECONDS
    )
    return NextResponse.json(payload)
  }

  const supabase = auth.supabase
  let query = supabase
    .schema("billing")
    .from("memberships")
    .select("*", { count: "exact" })
  query = applyListParams(query, [], { search, page, pageSize })
  const { data, error, count } = await query

  if (error) return dbError(error, "memberships:GET")
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

  const supabase = auth.supabase
  const { data, error } = await supabase
    .schema("billing")
    .from("memberships")
    .insert({ ...pickAllowed("memberships", body), org_id: orgId })
    .select()
    .single()

  if (error) {
    if (error.message.includes("membership_limit_reached")) {
      // Stable code for the client to translate — the raw trigger text is
      // deliberately not forwarded (audit NB-08).
      return NextResponse.json(
        {
          error: "This organization has reached its member limit.",
          code: "membership_limit_reached",
        },
        { status: 422 }
      )
    }
    return dbError(error, "memberships:POST")
  }

  void cacheBumpListVersion("memberships", orgId)
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
  const supabase = auth.supabase
  let query = supabase
    .schema("billing")
    .from("memberships")
    .update(pickAllowed("memberships", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "memberships:PUT")
  if (!data) return notFound()

  void cacheBumpListVersion("memberships", data.org_id)
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

  const supabase = auth.supabase
  let query = supabase
    .schema("billing")
    .from("memberships")
    .delete()
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "memberships:DELETE")
  if (data) {
    void cacheBumpListVersion("memberships", data.org_id)
  }
  return new NextResponse(null, { status: 204 })
}
