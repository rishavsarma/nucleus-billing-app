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
import {
  requireOrgId,
  verifyBelongsToOrg,
  type SupabaseClient,
} from "@/lib/database/require-org"

const VISIT_SELECT =
  "*, staff:staff(name, role, role_label), customer:customers(name)"
const STATUSES = ["planned", "completed", "cancelled"]

/** Verifies both FKs a visit can carry. RLS only checks the visit row's own
 * org_id, never staff_id/customer_id — see CLAUDE.md "Check every FK in the
 * body". Returns an error response, or null when everything checks out. */
async function verifyVisitRefs(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  orgId: string | null,
  isSuperadmin: boolean
) {
  if (
    body.staff_id &&
    !(await verifyBelongsToOrg(
      supabase,
      "staff",
      String(body.staff_id),
      orgId,
      isSuperadmin
    ))
  ) {
    return badRequest(
      "invalid_staff_id",
      "staff_id does not belong to this org"
    )
  }
  if (
    body.customer_id &&
    !(await verifyBelongsToOrg(
      supabase,
      "customers",
      String(body.customer_id),
      orgId,
      isSuperadmin
    ))
  ) {
    return badRequest(
      "invalid_customer_id",
      "customer_id does not belong to this org"
    )
  }
  if (body.status !== undefined && !STATUSES.includes(String(body.status))) {
    return badRequest("invalid_status", "status is invalid")
  }
  return null
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) return authError(auth.error)

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const supabase = auth.supabase

  if (id) {
    let recordQuery = supabase
      .schema("billing")
      .from("staff_visits")
      .select(VISIT_SELECT)
      .eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return dbError(error, "staff_visits:GET")
    if (!data) return notFound()
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? undefined
  const staffId = searchParams.get("staff_id")
  const status = searchParams.get("status")
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  let query = supabase
    .schema("billing")
    .from("staff_visits")
    .select(VISIT_SELECT, { count: "exact" })
    // Primary sort by when the visit happens; applyListParams appends
    // created_at as the tiebreaker.
    .order("visit_at", { ascending: false })
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  if (staffId) query = query.eq("staff_id", staffId)
  if (status && STATUSES.includes(status)) query = query.eq("status", status)
  query = applyListParams(query, ["place", "purpose", "outcome"], {
    search,
    page,
    pageSize,
  })

  const { data, error, count } = await query
  if (error) {
    if (isRangeError(error))
      return NextResponse.json({ data: [], total: count ?? 0 })
    return dbError(error, "staff_visits:GET")
  }
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) return authError(auth.error)

  const body = await readJson(request)
  if (!body)
    return badRequest("invalid_json", "Request body must be valid JSON.")

  const orgId = auth.isSuperadmin ? body.org_id : auth.orgId
  if (!orgId) return badRequest("missing_org_id", '"org_id" is required')
  if (!body.staff_id || !body.place || !body.visit_at) {
    return badRequest(
      "missing_required_field",
      '"staff_id", "place" and "visit_at" are required'
    )
  }

  const refError = await verifyVisitRefs(
    auth.supabase,
    body,
    orgId,
    auth.isSuperadmin
  )
  if (refError) return refError

  const { data, error } = await auth.supabase
    .schema("billing")
    .from("staff_visits")
    .insert({
      ...pickAllowed("staff_visits", body),
      org_id: orgId,
      created_by: auth.userId,
    })
    .select(VISIT_SELECT)
    .single()

  if (error) return dbError(error, "staff_visits:POST")
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return badRequest("missing_id", 'Query param "id" is required')

  const auth = await requireOrgId()
  if (auth.error) return authError(auth.error)

  const body = await readJson(request)
  if (!body)
    return badRequest("invalid_json", "Request body must be valid JSON.")

  // Re-verified on PUT, not just POST — a PUT can repoint staff_id/customer_id.
  const refError = await verifyVisitRefs(
    auth.supabase,
    body,
    auth.orgId,
    auth.isSuperadmin
  )
  if (refError) return refError

  let query = auth.supabase
    .schema("billing")
    .from("staff_visits")
    .update(pickAllowed("staff_visits", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select(VISIT_SELECT).maybeSingle()

  if (error) return dbError(error, "staff_visits:PUT")
  if (!data) return notFound()
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return badRequest("missing_id", 'Query param "id" is required')

  const auth = await requireOrgId()
  if (auth.error) return authError(auth.error)

  let query = auth.supabase
    .schema("billing")
    .from("staff_visits")
    .delete()
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select("id").maybeSingle()

  if (error) return dbError(error, "staff_visits:DELETE")
  if (!data) return notFound()
  return new NextResponse(null, { status: 204 })
}
