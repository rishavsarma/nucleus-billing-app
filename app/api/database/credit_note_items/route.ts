import { NextResponse } from "next/server"
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
  isSuperadmin: boolean,
) {
  let query = supabase.schema("billing").from("credit_notes").select("id").eq("id", creditNoteId)
  if (!isSuperadmin) query = query.eq("org_id", orgId!)
  const { data, error } = await query.maybeSingle()
  return { ok: !error && !!data, error }
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const creditNoteId = new URL(request.url).searchParams.get("credit_note_id")
  if (!creditNoteId) {
    return NextResponse.json(
      { error: 'Query param "credit_note_id" is required' },
      { status: 400 },
    )
  }

  if (!auth.isSuperadmin) {
    const cached = await cacheGet(creditNoteItemsCacheKey(auth.orgId!, creditNoteId))
    if (cached) return NextResponse.json(JSON.parse(cached))
  }

  const supabase = auth.supabase
  const { ok, error: verifyError } = await verifyCreditNoteInOrg(
    supabase,
    creditNoteId,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await supabase
    .schema("billing")
    .from("credit_note_items")
    .select("*")
    .eq("credit_note_id", creditNoteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!auth.isSuperadmin) {
    await cacheSet(creditNoteItemsCacheKey(auth.orgId!, creditNoteId), JSON.stringify(data ?? []), NOTE_ITEMS_CACHE_TTL_SECONDS)
  }

  return NextResponse.json(data)
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
  if (!body.credit_note_id) {
    return NextResponse.json({ error: '"credit_note_id" is required' }, { status: 400 })
  }

  const supabase = auth.supabase
  const { ok, error: verifyError } = await verifyCreditNoteInOrg(
    supabase,
    body.credit_note_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await supabase
    .schema("billing")
    .from("credit_note_items")
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
    return NextResponse.json({ error: 'Query param "id" is required' }, { status: 400 })
  }

  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const supabase = auth.supabase
  const { data: existing, error: existingError } = await supabase
    .schema("billing")
    .from("credit_note_items")
    .select("credit_note_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { ok, error: verifyError } = await verifyCreditNoteInOrg(
    supabase,
    existing.credit_note_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await request.json()
  const { data, error } = await supabase
    .schema("billing")
    .from("credit_note_items")
    .update(body)
    .eq("id", id)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

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
    return NextResponse.json({ error: 'Query param "id" is required' }, { status: 400 })
  }

  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const supabase = auth.supabase
  const { data: existing, error: existingError } = await supabase
    .schema("billing")
    .from("credit_note_items")
    .select("credit_note_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { ok, error: verifyError } = await verifyCreditNoteInOrg(
    supabase,
    existing.credit_note_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase.schema("billing").from("credit_note_items").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (auth.orgId) {
    await Promise.all([
      cacheDel(creditNoteItemsCacheKey(auth.orgId, existing.credit_note_id)),
      cacheDel(`credit-note:${auth.orgId}:${existing.credit_note_id}`),
    ])
  }

  return new NextResponse(null, { status: 204 })
}
