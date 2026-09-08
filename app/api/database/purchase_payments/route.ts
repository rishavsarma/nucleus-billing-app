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
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"
import {
  cacheBumpListVersion,
  cacheDel,
  cacheGet,
  cacheGetListVersion,
  cacheSet,
} from "@/lib/cache"
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
  releaseIdempotentRequest,
} from "@/lib/idempotency"

const IDEMPOTENCY_ROUTE = "purchase_payments"

const PURCHASE_PAYMENT_CACHE_TTL_SECONDS = 60

function billPaymentsCacheKey(orgId: string, purchaseBillId: string) {
  return `purchase-payments:bill:${orgId}:${purchaseBillId}`
}

function purchasePaymentListCacheKey(
  orgId: string,
  version: number,
  search: string,
  page: number,
  pageSize: number
) {
  return `purchase-payment-list:${orgId}:v${version}:${search}:${page}:${pageSize}`
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const { searchParams } = new URL(request.url)
  const purchaseBillId = searchParams.get("purchase_bill_id")
  const supabase = auth.supabase

  if (purchaseBillId) {
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(
        billPaymentsCacheKey(auth.orgId!, purchaseBillId)
      )
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let query = supabase
      .schema("billing")
      .from("purchase_payments")
      .select("*")
      .eq("purchase_bill_id", purchaseBillId)
      .order("paid_at", { ascending: false })
    if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId!)
    const { data, error } = await query

    if (error) return dbError(error, "purchase_payments:GET")

    if (!auth.isSuperadmin) {
      await cacheSet(
        billPaymentsCacheKey(auth.orgId!, purchaseBillId),
        JSON.stringify(data ?? []),
        PURCHASE_PAYMENT_CACHE_TTL_SECONDS
      )
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await cacheGetListVersion("purchase-payment", auth.orgId!)
    const listKey = purchasePaymentListCacheKey(
      auth.orgId!,
      version,
      search,
      page,
      pageSize
    )
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    let query = supabase
      .schema("billing")
      .from("purchase_payments")
      .select("*, bill:purchase_bills(bill_number, vendor:vendors(name))", {
        count: "exact",
      })
      .eq("org_id", auth.orgId)
    query = applyListParams(query, ["reference"], {
      search: search || undefined,
      page,
      pageSize,
    })
    const { data, error, count } = await query

    if (error) return dbError(error, "purchase_payments:GET")
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(
      listKey,
      JSON.stringify(payload),
      PURCHASE_PAYMENT_CACHE_TTL_SECONDS
    )
    return NextResponse.json(payload)
  }

  let query = supabase
    .schema("billing")
    .from("purchase_payments")
    .select("*, bill:purchase_bills(bill_number, vendor:vendors(name))", {
      count: "exact",
    })
  query = applyListParams(query, ["reference"], {
    search: search || undefined,
    page,
    pageSize,
  })
  const { data, error, count } = await query

  if (error) return dbError(error, "purchase_payments:GET")
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
  if (!body.purchase_bill_id) {
    return NextResponse.json(
      { error: '"purchase_bill_id" is required' },
      { status: 400 }
    )
  }

  // Same double-submit protection as app/api/database/payments/route.ts —
  // a purchase payment is real money moving too.
  const idempotencyKey = request.headers.get("Idempotency-Key")
  const idempotency = await beginIdempotentRequest(
    orgId,
    IDEMPOTENCY_ROUTE,
    idempotencyKey
  )
  if (idempotency.outcome === "replay") {
    return NextResponse.json(idempotency.body, {
      status: idempotency.httpStatus,
    })
  }
  if (idempotency.outcome === "in_progress") {
    return NextResponse.json(
      {
        error: "This payment is already being recorded.",
        code: "idempotency_in_progress",
      },
      { status: 409 }
    )
  }

  const supabase = auth.supabase
  if (
    !(await verifyBelongsToOrg(
      supabase,
      "purchase_bills",
      body.purchase_bill_id,
      orgId,
      auth.isSuperadmin
    ))
  ) {
    await releaseIdempotentRequest(orgId, IDEMPOTENCY_ROUTE, idempotencyKey)
    return NextResponse.json(
      { error: "purchase_bill_id does not belong to this org" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("purchase_payments")
    .insert({
      ...pickAllowed("purchase_payments", body),
      org_id: orgId,
      created_by: auth.userId,
    })
    .select()
    .single()

  if (error) {
    await releaseIdempotentRequest(orgId, IDEMPOTENCY_ROUTE, idempotencyKey)
    return dbError(error, "purchase_payments:POST")
  }

  await Promise.all([
    cacheDel(billPaymentsCacheKey(orgId, body.purchase_bill_id)),
    cacheDel(`purchase-bill:${orgId}:${body.purchase_bill_id}`), // invalidate parent purchase bill cache
  ])
  void cacheBumpListVersion("purchase-payment", orgId)
  void completeIdempotentRequest(
    orgId,
    IDEMPOTENCY_ROUTE,
    idempotencyKey,
    201,
    data
  )

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
    .from("purchase_payments")
    .update(pickAllowed("purchase_payments", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "purchase_payments:PUT")
  if (!data) return notFound()

  await Promise.all([
    cacheDel(billPaymentsCacheKey(data.org_id, data.purchase_bill_id)),
    cacheDel(`purchase-bill:${data.org_id}:${data.purchase_bill_id}`),
  ])
  void cacheBumpListVersion("purchase-payment", data.org_id)

  return NextResponse.json(data)
}
