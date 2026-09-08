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
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

const PLAN_CACHE_TTL_SECONDS = 120

function planCacheKey(orgId: string, invoiceId: string) {
  return `installment-plan:${orgId}:${invoiceId}`
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const invoiceId = new URL(request.url).searchParams.get("invoice_id")
  if (!invoiceId) {
    return NextResponse.json(
      { error: 'Query param "invoice_id" is required' },
      { status: 400 }
    )
  }

  if (!auth.isSuperadmin) {
    const cached = await cacheGet(planCacheKey(auth.orgId!, invoiceId))
    if (cached) return NextResponse.json(JSON.parse(cached))
  }

  const supabase = auth.supabase
  let query = supabase
    .schema("billing")
    .from("installment_plans")
    .select("*")
    .eq("invoice_id", invoiceId)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId!)
  const { data, error } = await query.maybeSingle()

  if (error) return dbError(error, "installment_plans:GET")

  if (!auth.isSuperadmin && data) {
    await cacheSet(
      planCacheKey(auth.orgId!, invoiceId),
      JSON.stringify(data),
      PLAN_CACHE_TTL_SECONDS
    )
  }

  return NextResponse.json(data)
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
  if (!body.invoice_id) {
    return NextResponse.json(
      { error: '"invoice_id" is required' },
      { status: 400 }
    )
  }

  const supabase = auth.supabase
  if (
    !(await verifyBelongsToOrg(
      supabase,
      "invoices",
      body.invoice_id,
      orgId,
      auth.isSuperadmin
    ))
  ) {
    return NextResponse.json(
      { error: "invoice_id does not belong to this org" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("installment_plans")
    .insert({
      ...pickAllowed("installment_plans", body),
      org_id: orgId,
      created_by: auth.userId,
    })
    .select()
    .single()

  if (error) return dbError(error, "installment_plans:POST")
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
    .from("installment_plans")
    .update(pickAllowed("installment_plans", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "installment_plans:PUT")
  if (!data) return notFound()

  await cacheDel(planCacheKey(data.org_id, data.invoice_id))
  return NextResponse.json(data)
}
