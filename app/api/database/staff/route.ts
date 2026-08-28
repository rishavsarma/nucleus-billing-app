import { NextResponse } from "next/server"
import { applyListParams } from "@/lib/database/list-params"
import { requireOrgId } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"
import { redis } from "@/lib/redis"

const STAFF_CACHE_TTL_SECONDS = 180

function staffCacheKey(orgId: string, id: string) {
  return `staff:${orgId}:${id}`
}

async function getListVersion(orgId: string): Promise<number> {
  try {
    const v = await redis.get(`staff-list-version:${orgId}`)
    return v ? parseInt(v, 10) : 0
  } catch {
    return 0
  }
}

async function bumpListVersion(orgId: string): Promise<void> {
  try {
    await redis.incr(`staff-list-version:${orgId}`)
  } catch {
    // swallow
  }
}

function staffListCacheKey(
  orgId: string,
  version: number,
  role: string,
  search: string,
  page: number,
  pageSize: number,
) {
  return `staff-list:${orgId}:v${version}:${role}:${search}:${page}:${pageSize}`
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
  const supabase = auth.supabase

  if (id) {
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(staffCacheKey(auth.orgId!, id))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let recordQuery = supabase.schema("billing").from("staff").select("*").eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (!auth.isSuperadmin) {
      await cacheSet(staffCacheKey(auth.orgId!, id), JSON.stringify(data), STAFF_CACHE_TTL_SECONDS)
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const role = searchParams.get("role") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await getListVersion(auth.orgId!)
    const listKey = staffListCacheKey(auth.orgId!, version, role, search, page, pageSize)
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    let query = supabase.schema("billing").from("staff").select("*", { count: "exact" })
    query = query.eq("org_id", auth.orgId)
    if (role) query = query.eq("role", role)
    query = applyListParams(query, ["name"], { search: search || undefined, page, pageSize })
    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(payload), STAFF_CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  }

  let query = supabase.schema("billing").from("staff").select("*", { count: "exact" })
  if (role) query = query.eq("role", role)
  query = applyListParams(query, ["name"], { search: search || undefined, page, pageSize })
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

  const supabase = auth.supabase
  const { data, error } = await supabase
    .schema("billing")
    .from("staff")
    .insert({ ...body, org_id: orgId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  void bumpListVersion(orgId)
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
  const supabase = auth.supabase
  let query = supabase.schema("billing").from("staff").update(body).eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await cacheDel(staffCacheKey(data.org_id, id))
  void bumpListVersion(data.org_id)
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

  const supabase = auth.supabase
  let query = supabase.schema("billing").from("staff").delete().eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data) {
    await cacheDel(staffCacheKey(data.org_id, id))
    void bumpListVersion(data.org_id)
  }
  return new NextResponse(null, { status: 204 })
}
