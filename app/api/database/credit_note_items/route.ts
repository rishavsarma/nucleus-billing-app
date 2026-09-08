import { NextResponse } from "next/server"
import { pickAllowed } from "@/lib/database/allowed-fields"
import {
  authError,
  badRequest,
  dbError,
  notFound,
  readJson,
} from "@/lib/api-response"
import { requireOrgId, type SupabaseClient } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

const NOTE_ITEMS_CACHE_TTL_SECONDS = 120

function creditNoteItemsCacheKey(orgId: string, creditNoteId: string) {
  return `credit-note-items:${orgId}:${creditNoteId}`
}

async function verifyCreditNoteInOrg(
  supabase: SupabaseClient,
  creditNoteId: string,
  orgId: string | null,
  isSuperadmin: boolean
) {
  let query = supabase
    .schema("billing")
    .from("credit_notes")
    .select("id")
    .eq("id", creditNoteId)
  if (!isSuperadmin) query = query.eq("org_id", orgId!)
  const { data, error } = await query.maybeSingle()
  return { ok: !error && !!data, error }
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const creditNoteId = new URL(request.url).searchParams.get("credit_note_id")
  if (!creditNoteId) {
    return NextResponse.json(
      { error: 'Query param "credit_note_id" is required' },
      { status: 400 }
    )
  }

  if (!auth.isSuperadmin) {
    const cached = await cacheGet(
      creditNoteItemsCacheKey(auth.orgId!, creditNoteId)
    )
    if (cached) return NextResponse.json(JSON.parse(cached))
  }

  const supabase = auth.supabase
  const { ok, error: verifyError } = await verifyCreditNoteInOrg(
    supabase,
    creditNoteId,
    auth.orgId,
    auth.isSuperadmin
  )
  if (verifyError) return dbError(verifyError, "credit_note_items:GET")
  if (!ok) return notFound()

  const { data, error } = await supabase
    .schema("billing")
    .from("credit_note_items")
    .select("*")
    .eq("credit_note_id", creditNoteId)

  if (error) return dbError(error, "credit_note_items:GET")

  if (!auth.isSuperadmin) {
    await cacheSet(
      creditNoteItemsCacheKey(auth.orgId!, creditNoteId),
      JSON.stringify(data ?? []),
      NOTE_ITEMS_CACHE_TTL_SECONDS
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
  if (!body.credit_note_id) {
    return NextResponse.json(
      { error: '"credit_note_id" is required' },
      { status: 400 }
    )
  }

  const supabase = auth.supabase
  const { ok, error: verifyError } = await verifyCreditNoteInOrg(
    supabase,
    body.credit_note_id,
    auth.orgId,
    auth.isSuperadmin
  )
  if (verifyError) return dbError(verifyError, "credit_note_items:POST")
  if (!ok) return notFound()

  const { data, error } = await supabase
    .schema("billing")
    .from("credit_note_items")
    .insert(pickAllowed("credit_note_items", body))
    .select()
    .single()

  if (error) return dbError(error, "credit_note_items:POST")

  if (auth.orgId) {
    await Promise.all([
      cacheDel(creditNoteItemsCacheKey(auth.orgId, body.credit_note_id)),
      cacheDel(`credit-note:${auth.orgId}:${body.credit_note_id}`),
    ])
  }

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

  const supabase = auth.supabase
  const { data: existing, error: existingError } = await supabase
    .schema("billing")
    .from("credit_note_items")
    .select("credit_note_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return dbError(existingError, "credit_note_items:PUT")
  if (!existing) return notFound()

  const { ok, error: verifyError } = await verifyCreditNoteInOrg(
    supabase,
    existing.credit_note_id,
    auth.orgId,
    auth.isSuperadmin
  )
  if (verifyError) return dbError(verifyError, "credit_note_items:PUT")
  if (!ok) return notFound()

  const body = await readJson(request)
  if (!body)
    return badRequest("invalid_json", "Request body must be valid JSON.")
  const { data, error } = await supabase
    .schema("billing")
    .from("credit_note_items")
    .update(pickAllowed("credit_note_items", body))
    .eq("id", id)
    .select()
    .maybeSingle()

  if (error) return dbError(error, "credit_note_items:PUT")
  if (!data) return notFound()

  if (auth.orgId) {
    await Promise.all([
      cacheDel(creditNoteItemsCacheKey(auth.orgId, existing.credit_note_id)),
      cacheDel(`credit-note:${auth.orgId}:${existing.credit_note_id}`),
    ])
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
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

  const supabase = auth.supabase
  const { data: existing, error: existingError } = await supabase
    .schema("billing")
    .from("credit_note_items")
    .select("credit_note_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return dbError(existingError, "credit_note_items:DELETE")
  if (!existing) return notFound()

  const { ok, error: verifyError } = await verifyCreditNoteInOrg(
    supabase,
    existing.credit_note_id,
    auth.orgId,
    auth.isSuperadmin
  )
  if (verifyError) return dbError(verifyError, "credit_note_items:DELETE")
  if (!ok) return notFound()

  const { error } = await supabase
    .schema("billing")
    .from("credit_note_items")
    .delete()
    .eq("id", id)
  if (error) return dbError(error, "credit_note_items:DELETE")

  if (auth.orgId) {
    await Promise.all([
      cacheDel(creditNoteItemsCacheKey(auth.orgId, existing.credit_note_id)),
      cacheDel(`credit-note:${auth.orgId}:${existing.credit_note_id}`),
    ])
  }

  return new NextResponse(null, { status: 204 })
}
