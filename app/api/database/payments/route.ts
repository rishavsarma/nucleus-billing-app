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

const IDEMPOTENCY_ROUTE = "payments"

const PAYMENT_CACHE_TTL_SECONDS = 60

function invoicePaymentsCacheKey(orgId: string, invoiceId: string) {
  return `payments:invoice:${orgId}:${invoiceId}`
}

function paymentListCacheKey(
  orgId: string,
  version: number,
  search: string,
  page: number,
  pageSize: number
) {
  return `payment-list:${orgId}:v${version}:${search}:${page}:${pageSize}`
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get("invoice_id")
  const supabase = auth.supabase

  if (invoiceId) {
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(
        invoicePaymentsCacheKey(auth.orgId!, invoiceId)
      )
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let query = supabase
      .schema("billing")
      .from("payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("paid_at", { ascending: false })
    if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId!)
    const { data, error } = await query

    if (error) return dbError(error, "payments:GET")

    if (!auth.isSuperadmin) {
      await cacheSet(
        invoicePaymentsCacheKey(auth.orgId!, invoiceId),
        JSON.stringify(data ?? []),
        PAYMENT_CACHE_TTL_SECONDS
      )
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await cacheGetListVersion("payment", auth.orgId!)
    const listKey = paymentListCacheKey(
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
      .from("payments")
      .select("*, invoice:invoices(invoice_number, customer:customers(name))", {
        count: "exact",
      })
      .eq("org_id", auth.orgId)
    query = applyListParams(query, ["reference"], {
      search: search || undefined,
      page,
      pageSize,
    })
    const { data, error, count } = await query

    if (error) return dbError(error, "payments:GET")
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(payload), PAYMENT_CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  }

  let query = supabase
    .schema("billing")
    .from("payments")
    .select("*, invoice:invoices(invoice_number, customer:customers(name))", {
      count: "exact",
    })
  query = applyListParams(query, ["reference"], {
    search: search || undefined,
    page,
    pageSize,
  })
  const { data, error, count } = await query

  if (error) return dbError(error, "payments:GET")
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
  if (!body.invoice_id) {
    return NextResponse.json(
      { error: '"invoice_id" is required' },
      { status: 400 }
    )
  }

  // A payment is real money moving — a double-submit (a slow network
  // causing a retry, a double-click before the button disables) must never
  // record the same payment twice. The client sends a stable key per
  // logical submission attempt (see hooks/use-payments.ts); replaying the
  // same key returns the original response instead of inserting again.
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
      "invoices",
      body.invoice_id,
      orgId,
      auth.isSuperadmin
    ))
  ) {
    await releaseIdempotentRequest(orgId, IDEMPOTENCY_ROUTE, idempotencyKey)
    return badRequest(
      "invalid_invoice_id",
      "invoice_id does not belong to this org"
    )
  }

  // installment_id reaches billing.installments_mark_paid(), a SECURITY
  // DEFINER trigger that settles the installment — so an unverified id here
  // was a cross-tenant write (audit NB-02). 020_security_fixes.sql also scopes
  // that trigger's UPDATE by org_id/invoice_id; this is the friendly 400.
  if (
    body.installment_id &&
    !(await verifyBelongsToOrg(
      supabase,
      "installments",
      body.installment_id,
      orgId,
      auth.isSuperadmin
    ))
  ) {
    await releaseIdempotentRequest(orgId, IDEMPOTENCY_ROUTE, idempotencyKey)
    return badRequest(
      "invalid_installment_id",
      "installment_id does not belong to this org"
    )
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("payments")
    .insert({
      ...pickAllowed("payments", body),
      org_id: orgId,
      created_by: auth.userId,
    })
    .select()
    .single()

  if (error) {
    await releaseIdempotentRequest(orgId, IDEMPOTENCY_ROUTE, idempotencyKey)
    return dbError(error, "payments:POST")
  }

  await Promise.all([
    cacheDel(invoicePaymentsCacheKey(orgId, body.invoice_id)),
    cacheDel(`invoice:${orgId}:${body.invoice_id}`), // invalidate parent invoice cache
  ])
  void cacheBumpListVersion("payment", orgId)
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
    .from("payments")
    .update(pickAllowed("payments", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "payments:PUT")
  if (!data) return notFound()

  await Promise.all([
    cacheDel(invoicePaymentsCacheKey(data.org_id, data.invoice_id)),
    cacheDel(`invoice:${data.org_id}:${data.invoice_id}`),
  ])
  void cacheBumpListVersion("payment", data.org_id)

  return NextResponse.json(data)
}
