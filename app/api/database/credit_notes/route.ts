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

const CREDIT_NOTE_CACHE_TTL_SECONDS = 60

function creditNoteCacheKey(orgId: string, id: string) {
  return `credit-note:${orgId}:${id}`
}

function creditNoteListCacheKey(
  orgId: string,
  version: number,
  search: string,
  page: number,
  pageSize: number
) {
  return `credit-note-list:${orgId}:v${version}:${search}:${page}:${pageSize}`
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
      const cached = await cacheGet(creditNoteCacheKey(auth.orgId!, id))
      if (cached) return NextResponse.json(JSON.parse(cached))
    }

    let recordQuery = supabase
      .schema("billing")
      .from("credit_notes")
      .select("*")
      .eq("id", id)
    if (!auth.isSuperadmin) recordQuery = recordQuery.eq("org_id", auth.orgId)
    const { data, error } = await recordQuery.maybeSingle()
    if (error) return dbError(error, "credit_notes:GET")
    if (!data) return notFound()

    if (!auth.isSuperadmin) {
      await cacheSet(
        creditNoteCacheKey(auth.orgId!, id),
        JSON.stringify(data),
        CREDIT_NOTE_CACHE_TTL_SECONDS
      )
    }
    return NextResponse.json(data)
  }

  const search = searchParams.get("search") ?? ""
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 10)

  if (!auth.isSuperadmin) {
    const version = await cacheGetListVersion("credit-note", auth.orgId!)
    const listKey = creditNoteListCacheKey(
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
      .from("credit_notes")
      .select("*, customer:customers(name)", { count: "exact" })
    query = query.eq("org_id", auth.orgId)
    query = applyListParams(query, ["credit_note_number"], {
      search: search || undefined,
      page,
      pageSize,
    })
    const { data, error, count } = await query

    if (error) return dbError(error, "credit_notes:GET")
    const payload = { data: data ?? [], total: count ?? 0 }
    await cacheSet(
      listKey,
      JSON.stringify(payload),
      CREDIT_NOTE_CACHE_TTL_SECONDS
    )
    return NextResponse.json(payload)
  }

  let query = supabase
    .schema("billing")
    .from("credit_notes")
    .select("*, customer:customers(name)", { count: "exact" })
  query = applyListParams(query, ["credit_note_number"], {
    search: search || undefined,
    page,
    pageSize,
  })
  const { data, error, count } = await query

  if (error) return dbError(error, "credit_notes:GET")
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
  const [custOk, invOk] = await Promise.all([
    verifyBelongsToOrg(
      supabase,
      "customers",
      body.customer_id,
      orgId,
      auth.isSuperadmin
    ),
    body.invoice_id
      ? verifyBelongsToOrg(
          supabase,
          "invoices",
          body.invoice_id,
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
  if (!invOk)
    return NextResponse.json(
      { error: "invoice_id does not belong to this org" },
      { status: 400 }
    )

  const { data, error } = await supabase
    .schema("billing")
    .from("credit_notes")
    .insert({
      ...pickAllowed("credit_notes", body),
      org_id: orgId,
      created_by: auth.userId,
    })
    .select()
    .single()

  if (error) return dbError(error, "credit_notes:POST")
  void cacheBumpListVersion("credit-note", orgId)
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
  const [custOk, invOk] = await Promise.all([
    body.customer_id
      ? verifyBelongsToOrg(
          supabase,
          "customers",
          body.customer_id,
          auth.orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
    body.invoice_id
      ? verifyBelongsToOrg(
          supabase,
          "invoices",
          body.invoice_id,
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
  if (!invOk)
    return NextResponse.json(
      { error: "invoice_id does not belong to this org" },
      { status: 400 }
    )

  let query = supabase
    .schema("billing")
    .from("credit_notes")
    .update(pickAllowed("credit_notes", body))
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return dbError(error, "credit_notes:PUT")
  if (!data) return notFound()

  await cacheDel(creditNoteCacheKey(data.org_id, id))
  void cacheBumpListVersion("credit-note", data.org_id)
  return NextResponse.json(data)
}
