import { NextResponse } from "next/server"
import { applyListParams } from "@/lib/database/list-params"
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"
import { redis } from "@/lib/redis"

const PAYMENT_CACHE_TTL_SECONDS = 60

function invoicePaymentsCacheKey(orgId: string, invoiceId: string) {
  return `payments:invoice:${orgId}:${invoiceId}`
}

async function getListVersion(orgId: string): Promise<number> {
  try {
    const v = await redis.get(`payment-list-version:${orgId}`)
    return v ? parseInt(v, 10) : 0
  } catch {
    return 0
  }
}

async function bumpListVersion(orgId: string): Promise<void> {
  try {
    await redis.incr(`payment-list-version:${orgId}`)
  } catch {
    // swallow
  }
}

function paymentListCacheKey(
  orgId: string,
  version: number,
  search: string,
  page: number,
  pageSize: number,
) {
  return `payment-list:${orgId}:v${version}:${search}:${page}:${pageSize}`
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
  const invoiceId = searchParams.get("invoice_id")
  const supabase = auth.supabase

  if (invoiceId) {
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(invoicePaymentsCacheKey(auth.orgId!, invoiceId))
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!auth.isSuperadmin) {
      await cacheSet(invoicePaymentsCacheKey(auth.orgId!, invoiceId), JSON.stringify(data ?? []), PAYMENT_CACHE_TTL_SECONDS)
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await getListVersion(auth.orgId!)
    const listKey = paymentListCacheKey(auth.orgId!, version, search, page, pageSize)
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    let query = supabase
      .schema("billing")
      .from("payments")
      .select("*, invoice:invoices(invoice_number, customer:customers(name))", { count: "exact" })
      .eq("org_id", auth.orgId)
    query = applyListParams(query, ["reference"], { search: search || undefined, page, pageSize })
    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(payload), PAYMENT_CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  }

  let query = supabase
    .schema("billing")
    .from("payments")
    .select("*, invoice:invoices(invoice_number, customer:customers(name))", { count: "exact" })
  query = applyListParams(query, ["reference"], { search: search || undefined, page, pageSize })
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
  if (!body.invoice_id) {
    return NextResponse.json({ error: '"invoice_id" is required' }, { status: 400 })
  }

  const supabase = auth.supabase
  if (!(await verifyBelongsToOrg(supabase, "invoices", body.invoice_id, orgId, auth.isSuperadmin))) {
    return NextResponse.json({ error: "invoice_id does not belong to this org" }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("payments")
    .insert({ ...body, org_id: orgId, created_by: auth.userId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await Promise.all([
    cacheDel(invoicePaymentsCacheKey(orgId, body.invoice_id)),
    cacheDel(`invoice:${orgId}:${body.invoice_id}`), // invalidate parent invoice cache
  ])
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
  let query = supabase.schema("billing").from("payments").update(body).eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await Promise.all([
    cacheDel(invoicePaymentsCacheKey(data.org_id, data.invoice_id)),
    cacheDel(`invoice:${data.org_id}:${data.invoice_id}`),
  ])
  void bumpListVersion(data.org_id)

  return NextResponse.json(data)
}
