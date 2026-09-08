import { NextResponse } from "next/server"
import {
  ORG_SUPERADMIN_FIELDS,
  pickAllowed,
} from "@/lib/database/allowed-fields"
import {
  authError,
  badRequest,
  dbError,
  notFound,
  readJson,
} from "@/lib/api-response"
import { applyListParams } from "@/lib/database/list-params"
import {
  requireAdminOf,
  requireOrgId,
  requireSuperadmin,
} from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

const ORG_CACHE_TTL_SECONDS = 300

function orgCacheKey(orgId: string) {
  return `org:${orgId}`
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
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

    const query = supabase
      .schema("billing")
      .from("organizations")
      .select("*")
      .eq("id", targetOrgId)
    const { data, error } = await query.maybeSingle()

    if (error) return dbError(error, "organizations:GET")
    if (!data) return notFound()

    if (!auth.isSuperadmin) {
      await cacheSet(
        orgCacheKey(targetOrgId),
        JSON.stringify(data),
        ORG_CACHE_TTL_SECONDS
      )
    }
    return NextResponse.json(data)
  }

  // Paginated list for superadmin
  const search = searchParams.get("search") ?? undefined
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  let query = supabase
    .schema("billing")
    .from("organizations")
    .select("*", { count: "exact" })
  query = applyListParams(query, ["name"], { search, page, pageSize })
  const { data, error, count } = await query

  if (error) return dbError(error, "organizations:GET")
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 403 })
  }

  const body = await readJson(request)
  if (!body)
    return badRequest("invalid_json", "Request body must be valid JSON.")
  const supabase = auth.supabase

  const { data: org, error: orgError } = await supabase
    .schema("billing")
    .from("organizations")
    .insert(pickAllowed("organizations", body))
    .select()
    .single()
  if (orgError) return dbError(orgError, "organizations:POST")

  return NextResponse.json(org, { status: 201 })
}

export async function PUT(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) {
    return NextResponse.json(
      { error: 'Query param "id" is required' },
      { status: 400 }
    )
  }

  // Admin-level, matching what organizations_update RLS already requires —
  // a plain member previously reached the query and got a 404 back (NB-09).
  const auth = await requireAdminOf(id)
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error, code: auth.error },
      { status: 403 }
    )
  }

  const body = await readJson(request)
  if (!body)
    return badRequest("invalid_json", "Request body must be valid JSON.")

  const superadminFieldsSent = ORG_SUPERADMIN_FIELDS.filter((f) => f in body)
  if (superadminFieldsSent.length > 0 && !auth.isSuperadmin) {
    return badRequest(
      "superadmin_only_field",
      `Only a superadmin can change: ${superadminFieldsSent.join(", ")}`,
      403
    )
  }

  // pickAllowed drops the subscription fields for everyone; a superadmin gets
  // them merged back in explicitly. All three are additionally trigger-guarded
  // in the database, so this is the friendly path, not the only one.
  const update: Record<string, unknown> = pickAllowed("organizations", body)
  if (auth.isSuperadmin) {
    for (const field of superadminFieldsSent) update[field] = body[field]
  }

  const supabase = auth.supabase
  const { data, error } = await supabase
    .schema("billing")
    .from("organizations")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle()

  if (error) return dbError(error, "organizations:PUT")
  if (!data) return notFound()

  await cacheDel(orgCacheKey(id))
  return NextResponse.json(data)
}
