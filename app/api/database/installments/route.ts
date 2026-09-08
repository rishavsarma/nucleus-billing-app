import { NextResponse } from "next/server"
import { pickAllowed } from "@/lib/database/allowed-fields"
import {
  authError,
  badRequest,
  dbError,
  notFound,
  readJson,
} from "@/lib/api-response"
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"
import {
  cacheBumpListVersion,
  cacheDel,
  cacheGet,
  cacheGetListVersion,
  cacheSet,
} from "@/lib/cache"

const INSTALLMENT_CACHE_TTL_SECONDS = 60

function planInstallmentsCacheKey(orgId: string, planId: string) {
  return `installments:plan:${orgId}:${planId}`
}

function installmentListCacheKey(
  orgId: string,
  version: number,
  page: number,
  pageSize: number
) {
  return `installments-list:${orgId}:v${version}:${page}:${pageSize}`
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const { searchParams } = new URL(request.url)
  const planId = searchParams.get("plan_id")
  const supabase = auth.supabase

  if (planId) {
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(
        planInstallmentsCacheKey(auth.orgId!, planId)
      )
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let query = supabase
      .schema("billing")
      .from("installments")
      .select("*")
      .eq("plan_id", planId)
      .order("installment_number", { ascending: true })
    if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId!)
    const { data, error } = await query

    if (error) return dbError(error, "installments:GET")

    if (!auth.isSuperadmin) {
      await cacheSet(
        planInstallmentsCacheKey(auth.orgId!, planId),
        JSON.stringify(data ?? []),
        INSTALLMENT_CACHE_TTL_SECONDS
      )
    }
    return NextResponse.json(data)
  }

  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  if (!auth.isSuperadmin) {
    const version = await cacheGetListVersion("installments", auth.orgId!)
    const listKey = installmentListCacheKey(
      auth.orgId!,
      version,
      page,
      pageSize
    )
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    let query = supabase
      .schema("billing")
      .from("installments")
      .select("*, invoice:invoices(invoice_number)", { count: "exact" })
      .eq("org_id", auth.orgId)
    query = query.order("due_date", { ascending: true }).range(from, to)
    const { data, error, count } = await query

    if (error) return dbError(error, "installments:GET")
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(
      listKey,
      JSON.stringify(payload),
      INSTALLMENT_CACHE_TTL_SECONDS
    )
    return NextResponse.json(payload)
  }

  let query = supabase
    .schema("billing")
    .from("installments")
    .select("*, invoice:invoices(invoice_number)", { count: "exact" })
  query = query.order("due_date", { ascending: true }).range(from, to)
  const { data, error, count } = await query

  if (error) return dbError(error, "installments:GET")
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
  if (!body.plan_id) {
    return NextResponse.json(
      { error: '"plan_id" is required' },
      { status: 400 }
    )
  }

  const supabase = auth.supabase
  if (
    !(await verifyBelongsToOrg(
      supabase,
      "installment_plans",
      body.plan_id,
      orgId,
      auth.isSuperadmin
    ))
  ) {
    return NextResponse.json(
      { error: "plan_id does not belong to this org" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("installments")
    .insert({ ...pickAllowed("installments", body), org_id: orgId })
    .select()
    .single()

  if (error) return dbError(error, "installments:POST")

  await cacheDel(planInstallmentsCacheKey(orgId, body.plan_id))
  void cacheBumpListVersion("installments", orgId)

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
    .from("installments")
    .update(pickAllowed("installments", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "installments:PUT")
  if (!data) return notFound()

  await cacheDel(planInstallmentsCacheKey(data.org_id, data.plan_id))
  void cacheBumpListVersion("installments", data.org_id)

  return NextResponse.json(data)
}
