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

const BILL_CACHE_TTL_SECONDS = 60

function billCacheKey(orgId: string, id: string) {
  return `purchase-bill:${orgId}:${id}`
}

function billListCacheKey(
  orgId: string,
  version: number,
  vendorId: string,
  search: string,
  page: number,
  pageSize: number
) {
  return `purchase-bill-list:${orgId}:v${version}:${vendorId}:${search}:${page}:${pageSize}`
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
      const cached = await cacheGet(billCacheKey(auth.orgId!, id))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let recordQuery = supabase
      .schema("billing")
      .from("purchase_bills")
      .select("*")
      .eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return dbError(error, "purchase_bills:GET")
    if (!data) return notFound()

    if (!auth.isSuperadmin) {
      await cacheSet(
        billCacheKey(auth.orgId!, id),
        JSON.stringify(data),
        BILL_CACHE_TTL_SECONDS
      )
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)
  const vendorId = searchParams.get("vendor_id") ?? ""

  if (!auth.isSuperadmin) {
    const version = await cacheGetListVersion("purchase-bill", auth.orgId!)
    const listKey = billListCacheKey(
      auth.orgId!,
      version,
      vendorId,
      search,
      page,
      pageSize
    )
    const cached = await cacheGet(listKey)
    if (cached) return NextResponse.json(JSON.parse(cached))

    let query = supabase
      .schema("billing")
      .from("purchase_bills")
      .select("*, vendor:vendors(name)", { count: "exact" })
    query = query.eq("org_id", auth.orgId)
    if (vendorId) query = query.eq("vendor_id", vendorId)
    query = applyListParams(query, ["bill_number", "vendor_invoice_number"], {
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
          BILL_CACHE_TTL_SECONDS
        )
        return NextResponse.json(emptyPayload)
      }
      return dbError(error, "purchase_bills:GET")
    }
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(listKey, JSON.stringify(payload), BILL_CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  }

  let query = supabase
    .schema("billing")
    .from("purchase_bills")
    .select("*, vendor:vendors(name)", { count: "exact" })
  if (vendorId) query = query.eq("vendor_id", vendorId)
  query = applyListParams(query, ["bill_number", "vendor_invoice_number"], {
    search: search || undefined,
    page,
    pageSize,
  })
  const { data, error, count } = await query

  if (error) {
    if (isRangeError(error))
      return NextResponse.json({ data: [], total: count ?? 0 })
    return dbError(error, "purchase_bills:GET")
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
  if (!body.vendor_id) {
    return NextResponse.json(
      { error: '"vendor_id" is required' },
      { status: 400 }
    )
  }

  const supabase = auth.supabase
  const [vendOk, whOk, bankOk] = await Promise.all([
    verifyBelongsToOrg(
      supabase,
      "vendors",
      body.vendor_id,
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

  if (!vendOk)
    return NextResponse.json(
      { error: "vendor_id does not belong to this org" },
      { status: 400 }
    )
  if (!whOk)
    return NextResponse.json(
      { error: "warehouse_id does not belong to this org" },
      { status: 400 }
    )
  if (!bankOk)
    return NextResponse.json(
      { error: "bank_account_id does not belong to this org" },
      { status: 400 }
    )

  const { data, error } = await supabase
    .schema("billing")
    .from("purchase_bills")
    .insert({
      ...pickAllowed("purchase_bills", body),
      org_id: orgId,
      created_by: auth.userId,
    })
    .select()
    .single()

  if (error) return dbError(error, "purchase_bills:POST")
  void cacheBumpListVersion("purchase-bill", orgId)
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

  // Re-verify any FK present in the update body — see invoices/route.ts PUT
  // for why this needs the same checks as POST, not just the parent org.
  const [vendOk, whOk, bankOk] = await Promise.all([
    body.vendor_id
      ? verifyBelongsToOrg(
          supabase,
          "vendors",
          body.vendor_id,
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
  if (!vendOk)
    return NextResponse.json(
      { error: "vendor_id does not belong to this org" },
      { status: 400 }
    )
  if (!whOk)
    return NextResponse.json(
      { error: "warehouse_id does not belong to this org" },
      { status: 400 }
    )
  if (!bankOk)
    return NextResponse.json(
      { error: "bank_account_id does not belong to this org" },
      { status: 400 }
    )

  let query = supabase
    .schema("billing")
    .from("purchase_bills")
    .update(pickAllowed("purchase_bills", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "purchase_bills:PUT")
  if (!data) return notFound()

  await cacheDel(billCacheKey(data.org_id, id))
  void cacheBumpListVersion("purchase-bill", data.org_id)
  return NextResponse.json(data)
}
