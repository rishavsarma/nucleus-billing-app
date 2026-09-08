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

const STAFF_CACHE_TTL_SECONDS = 180

function staffCacheKey(orgId: string, id: string) {
  return `staff:${orgId}:${id}`
}

function staffListCacheKey(
  orgId: string,
  version: number,
  role: string,
  search: string,
  page: number,
  pageSize: number
) {
  return `staff-list:${orgId}:v${version}:${role}:${search}:${page}:${pageSize}`
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const supabase = auth.supabase

  if (id) {
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(staffCacheKey(auth.orgId!, id))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let recordQuery = supabase
      .schema("billing")
      .from("staff")
      .select("*")
      .eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return dbError(error, "staff:GET")
    if (!data) return notFound()

    if (!auth.isSuperadmin) {
      await cacheSet(
        staffCacheKey(auth.orgId!, id),
        JSON.stringify(data),
        STAFF_CACHE_TTL_SECONDS
      )
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const role = searchParams.get("role") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await cacheGetListVersion("staff", auth.orgId!)
    const listKey = staffListCacheKey(
      auth.orgId!,
      version,
      role,
      search,
      page,
      pageSize
    )
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    let query = supabase
      .schema("billing")
      .from("staff")
      .select("*", { count: "exact" })
    query = query.eq("org_id", auth.orgId)
    if (role) query = query.eq("role", role)
    query = applyListParams(query, ["name"], {
      search: search || undefined,
      page,
      pageSize,
    })
    const { data, error, count } = await query

    if (error) return dbError(error, "staff:GET")
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(payload), STAFF_CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  }

  let query = supabase
    .schema("billing")
    .from("staff")
    .select("*", { count: "exact" })
  if (role) query = query.eq("role", role)
  query = applyListParams(query, ["name"], {
    search: search || undefined,
    page,
    pageSize,
  })
  const { data, error, count } = await query

  if (error) return dbError(error, "staff:GET")
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
    .from("staff")
    .insert({ ...pickAllowed("staff", body), org_id: orgId })
    .select()
    .single()

  if (error) return dbError(error, "staff:POST")
  void cacheBumpListVersion("staff", orgId)
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
    .from("staff")
    .update(pickAllowed("staff", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "staff:PUT")
  if (!data) return notFound()

  await cacheDel(staffCacheKey(data.org_id, id))
  void cacheBumpListVersion("staff", data.org_id)
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
  let query = supabase.schema("billing").from("staff").delete().eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "staff:DELETE")
  if (data) {
    await cacheDel(staffCacheKey(data.org_id, id))
    void cacheBumpListVersion("staff", data.org_id)
  }
  return new NextResponse(null, { status: 204 })
}
