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

const DEBIT_NOTE_CACHE_TTL_SECONDS = 60

function debitNoteCacheKey(orgId: string, id: string) {
  return `debit-note:${orgId}:${id}`
}

function debitNoteListCacheKey(
  orgId: string,
  version: number,
  search: string,
  page: number,
  pageSize: number
) {
  return `debit-note-list:${orgId}:v${version}:${search}:${page}:${pageSize}`
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
      const cached = await cacheGet(debitNoteCacheKey(auth.orgId!, id))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let recordQuery = supabase
      .schema("billing")
      .from("debit_notes")
      .select("*")
      .eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return dbError(error, "debit_notes:GET")
    if (!data) return notFound()

    if (!auth.isSuperadmin) {
      await cacheSet(
        debitNoteCacheKey(auth.orgId!, id),
        JSON.stringify(data),
        DEBIT_NOTE_CACHE_TTL_SECONDS
      )
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await cacheGetListVersion("debit-note", auth.orgId!)
    const listKey = debitNoteListCacheKey(
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
      .from("debit_notes")
      .select("*, vendor:vendors(name)", { count: "exact" })
    query = query.eq("org_id", auth.orgId)
    query = applyListParams(query, ["debit_note_number"], {
      search: search || undefined,
      page,
      pageSize,
    })
    const { data, error, count } = await query

    if (error) return dbError(error, "debit_notes:GET")
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(
      listKey,
      JSON.stringify(payload),
      DEBIT_NOTE_CACHE_TTL_SECONDS
    )
    return NextResponse.json(payload)
  }

  let query = supabase
    .schema("billing")
    .from("debit_notes")
    .select("*, vendor:vendors(name)", { count: "exact" })
  query = applyListParams(query, ["debit_note_number"], {
    search: search || undefined,
    page,
    pageSize,
  })
  const { data, error, count } = await query

  if (error) return dbError(error, "debit_notes:GET")
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
  const [vendOk, billOk] = await Promise.all([
    verifyBelongsToOrg(
      supabase,
      "vendors",
      body.vendor_id,
      orgId,
      auth.isSuperadmin
    ),
    body.purchase_bill_id
      ? verifyBelongsToOrg(
          supabase,
          "purchase_bills",
          body.purchase_bill_id,
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
  if (!billOk)
    return NextResponse.json(
      { error: "purchase_bill_id does not belong to this org" },
      { status: 400 }
    )

  const { data, error } = await supabase
    .schema("billing")
    .from("debit_notes")
    .insert({
      ...pickAllowed("debit_notes", body),
      org_id: orgId,
      created_by: auth.userId,
    })
    .select()
    .single()

  if (error) return dbError(error, "debit_notes:POST")
  void cacheBumpListVersion("debit-note", orgId)
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
  const [vendOk, billOk] = await Promise.all([
    body.vendor_id
      ? verifyBelongsToOrg(
          supabase,
          "vendors",
          body.vendor_id,
          auth.orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
    body.purchase_bill_id
      ? verifyBelongsToOrg(
          supabase,
          "purchase_bills",
          body.purchase_bill_id,
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
  if (!billOk)
    return NextResponse.json(
      { error: "purchase_bill_id does not belong to this org" },
      { status: 400 }
    )

  let query = supabase
    .schema("billing")
    .from("debit_notes")
    .update(pickAllowed("debit_notes", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "debit_notes:PUT")
  if (!data) return notFound()

  await cacheDel(debitNoteCacheKey(data.org_id, id))
  void cacheBumpListVersion("debit-note", data.org_id)
  return NextResponse.json(data)
}
