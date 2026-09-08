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
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"
import {
  cacheBumpListVersion,
  cacheDel,
  cacheGet,
  cacheGetListVersion,
  cacheSet,
} from "@/lib/cache"

const INVOICE_CACHE_TTL_SECONDS = 60

function invoiceCacheKey(orgId: string, id: string) {
  return `invoice:${orgId}:${id}`
}

function invoiceListCacheKey(
  orgId: string,
  version: number,
  customerId: string,
  search: string,
  page: number,
  pageSize: number
) {
  return `invoice-list:${orgId}:v${version}:${customerId}:${search}:${page}:${pageSize}`
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const supabase = auth.supabase

  if (id) {
    if (!auth.isSuperadmin) {
      const cached = await cacheGet(invoiceCacheKey(auth.orgId!, id))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let recordQuery = supabase
      .schema("billing")
      .from("invoices")
      .select("*")
      .eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return dbError(error, "invoices:GET")
    if (!data) return notFound()

    if (!auth.isSuperadmin) {
      await cacheSet(
        invoiceCacheKey(auth.orgId!, id),
        JSON.stringify(data),
        INVOICE_CACHE_TTL_SECONDS
      )
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)
  const customerId = searchParams.get("customer_id") ?? ""

  if (!auth.isSuperadmin) {
    const version = await cacheGetListVersion("invoice", auth.orgId!)
    const listKey = invoiceListCacheKey(
      auth.orgId!,
      version,
      customerId,
      search,
      page,
      pageSize
    )
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    let query = supabase
      .schema("billing")
      .from("invoices")
      .select("*, customer:customers(name)", { count: "exact" })
    query = query.eq("org_id", auth.orgId)
    if (customerId) query = query.eq("customer_id", customerId)
    query = applyListParams(query, ["invoice_number"], {
      search: search || undefined,
      page,
      pageSize,
    })
    const { data, error, count } = await query

    if (error) {
      if (isRangeError(error)) {
        const emptyPayload = { data: [], total: count ?? 0 }
        await cacheSet(
          listKey,
          JSON.stringify(emptyPayload),
          INVOICE_CACHE_TTL_SECONDS
        )
        return NextResponse.json(emptyPayload)
      }
      return dbError(error, "invoices:GET")
    }

    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(payload), INVOICE_CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  }

  let query = supabase
    .schema("billing")
    .from("invoices")
    .select("*, customer:customers(name)", { count: "exact" })
  if (customerId) query = query.eq("customer_id", customerId)
  query = applyListParams(query, ["invoice_number"], {
    search: search || undefined,
    page,
    pageSize,
  })
  const { data, error, count } = await query

  if (error) {
    if (isRangeError(error))
      return NextResponse.json({ data: [], total: count ?? 0 })
    return dbError(error, "invoices:GET")
  }
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
  if (!body.customer_id) {
    return NextResponse.json(
      { error: '"customer_id" is required' },
      { status: 400 }
    )
  }

  const supabase = auth.supabase
  const [custOk, whOk, offOk, bankOk] = await Promise.all([
    verifyBelongsToOrg(
      supabase,
      "customers",
      body.customer_id,
      orgId,
      auth.isSuperadmin
    ),
    body.warehouse_id
      ? verifyBelongsToOrg(
          supabase,
          "warehouses",
          body.warehouse_id,
          orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
    body.offer_id
      ? verifyBelongsToOrg(
          supabase,
          "offers",
          body.offer_id,
          orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
    body.bank_account_id
      ? verifyBelongsToOrg(
          supabase,
          "organization_bank_accounts",
          body.bank_account_id,
          orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
  ])

  if (!custOk)
    return NextResponse.json(
      { error: "customer_id does not belong to this org" },
      { status: 400 }
    )
  if (!whOk)
    return NextResponse.json(
      { error: "warehouse_id does not belong to this org" },
      { status: 400 }
    )
  if (!offOk)
    return NextResponse.json(
      { error: "offer_id does not belong to this org" },
      { status: 400 }
    )
  if (!bankOk)
    return NextResponse.json(
      { error: "bank_account_id does not belong to this org" },
      { status: 400 }
    )

  const { data, error } = await supabase
    .schema("billing")
    .from("invoices")
    .insert({
      ...pickAllowed("invoices", body),
      org_id: orgId,
      created_by: auth.userId,
    })
    .select()
    .single()

  if (error) return dbError(error, "invoices:POST")
  void cacheBumpListVersion("invoice", orgId)
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

  // Re-verify any FK present in the update body — RLS only checks this row's
  // own org_id, never a sibling FK being written into it (same class of gap
  // already fixed on POST; PUT needs the identical checks since it can just
  // as easily retarget customer_id/warehouse_id/offer_id to another org).
  const [custOk, whOk, offOk, bankOk] = await Promise.all([
    body.customer_id
      ? verifyBelongsToOrg(
          supabase,
          "customers",
          body.customer_id,
          auth.orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
    body.warehouse_id
      ? verifyBelongsToOrg(
          supabase,
          "warehouses",
          body.warehouse_id,
          auth.orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
    body.offer_id
      ? verifyBelongsToOrg(
          supabase,
          "offers",
          body.offer_id,
          auth.orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
    body.bank_account_id
      ? verifyBelongsToOrg(
          supabase,
          "organization_bank_accounts",
          body.bank_account_id,
          auth.orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
  ])
  if (!custOk)
    return NextResponse.json(
      { error: "customer_id does not belong to this org" },
      { status: 400 }
    )
  if (!whOk)
    return NextResponse.json(
      { error: "warehouse_id does not belong to this org" },
      { status: 400 }
    )
  if (!offOk)
    return NextResponse.json(
      { error: "offer_id does not belong to this org" },
      { status: 400 }
    )
  if (!bankOk)
    return NextResponse.json(
      { error: "bank_account_id does not belong to this org" },
      { status: 400 }
    )

  let query = supabase
    .schema("billing")
    .from("invoices")
    .update(pickAllowed("invoices", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "invoices:PUT")
  if (!data) return notFound()

  await cacheDel(invoiceCacheKey(data.org_id, id))
  void cacheBumpListVersion("invoice", data.org_id)
  return NextResponse.json(data)
}
