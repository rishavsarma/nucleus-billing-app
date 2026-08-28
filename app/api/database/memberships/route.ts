import { NextResponse } from "next/server"
import { applyListParams } from "@/lib/database/list-params"
import { requireOrgId } from "@/lib/database/require-org"
import { cacheGet, cacheSet } from "@/lib/cache"
import { redis } from "@/lib/redis"

const MEMBERSHIP_CACHE_TTL_SECONDS = 180

async function getListVersion(orgId: string): Promise<number> {
  try {
    const v = await redis.get(`memberships-list-version:${orgId}`)
    return v ? parseInt(v, 10) : 0
  } catch {
    return 0
  }
}

async function bumpListVersion(orgId: string): Promise<void> {
  try {
    await redis.incr(`memberships-list-version:${orgId}`)
  } catch {
    // swallow
  }
}

function membershipListCacheKey(orgId: string, version: number, page: number, pageSize: number) {
  return `memberships-list:${orgId}:v${version}:${page}:${pageSize}`
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
  const search = searchParams.get("search") ?? undefined
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await getListVersion(auth.orgId!)
    const listKey = membershipListCacheKey(auth.orgId!, version, page, pageSize)
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    const supabase = auth.supabase
    let query = supabase.schema("billing").from("memberships").select("*", { count: "exact" }).eq("org_id", auth.orgId)
    query = applyListParams(query, [], { search, page, pageSize })
    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(payload), MEMBERSHIP_CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  }

  const supabase = auth.supabase
  let query = supabase.schema("billing").from("memberships").select("*", { count: "exact" })
  query = applyListParams(query, [], { search, page, pageSize })
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
    .from("memberships")
    .insert({ ...body, org_id: orgId })
    .select()
    .single()

  if (error) {
    if (error.message.includes("membership_limit_reached")) {
      return NextResponse.json({ error: error.message, code: "membership_limit_reached" }, { status: 422 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

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
  let query = supabase.schema("billing").from("memberships").update(body).eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

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
  let query = supabase.schema("billing").from("memberships").delete().eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data) {
    void bumpListVersion(data.org_id)
  }
  return new NextResponse(null, { status: 204 })
}
