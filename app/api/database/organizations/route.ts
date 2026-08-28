import { NextResponse } from "next/server"
import { applyListParams } from "@/lib/database/list-params"
import { requireOrgId, requireSuperadmin, requireMemberOf } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

const ORG_CACHE_TTL_SECONDS = 300

function orgCacheKey(orgId: string) {
  return `org:${orgId}`
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

  // Single org — either explicit lookup or user's own org
  if (id || !auth.isSuperadmin) {
    const targetOrgId = id ?? auth.orgId!

    if (!auth.isSuperadmin) {
      const cached = await cacheGet(orgCacheKey(targetOrgId))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    const query = supabase.schema("billing").from("organizations").select("*").eq("id", targetOrgId)
    const { data, error } = await query.maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (!auth.isSuperadmin) {
      await cacheSet(orgCacheKey(targetOrgId), JSON.stringify(data), ORG_CACHE_TTL_SECONDS)
    }
    return NextResponse.json(data)
  }

  // Paginated list for superadmin
  const search = searchParams.get("search") ?? undefined
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  let query = supabase.schema("billing").from("organizations").select("*", { count: "exact" })
  query = applyListParams(query, ["name"], { search, page, pageSize })
  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 403 })
  }

  const body = await request.json()
  const supabase = auth.supabase

  const { data: org, error: orgError } = await supabase
    .schema("billing")
    .from("organizations")
    .insert(body)
    .select()
    .single()
  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 })

  return NextResponse.json(org, { status: 201 })
}

export async function PUT(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: 'Query param "id" is required' }, { status: 400 })
  }

  const auth = await requireMemberOf(id)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const body = await request.json()

  if ("is_active" in body || "subscription_status" in body) {
    if (!auth.isSuperadmin) {
      return NextResponse.json({ error: "Only a superadmin can change is_active or subscription_status" }, { status: 403 })
    }
  }

  const supabase = auth.supabase
  const { data, error } = await supabase
    .schema("billing")
    .from("organizations")
    .update(body)
    .eq("id", id)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await cacheDel(orgCacheKey(id))
  return NextResponse.json(data)
}
