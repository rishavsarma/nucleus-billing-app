import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"

async function verifyOfferInOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  offerId: string,
  orgId: string | null,
  isSuperadmin: boolean,
) {
  let query = supabase.schema("billing").from("offers").select("id").eq("id", offerId)
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

  const offerId = new URL(request.url).searchParams.get("offer_id")
  if (!offerId) {
    return NextResponse.json({ error: 'Query param "offer_id" is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { ok, error: verifyError } = await verifyOfferInOrg(
    supabase,
    offerId,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await supabase
    .schema("billing")
    .from("offer_items")
    .select("*")
    .eq("offer_id", offerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
  if (!body.offer_id || !body.item_id) {
    return NextResponse.json({ error: '"offer_id" and "item_id" are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { ok, error: verifyError } = await verifyOfferInOrg(
    supabase,
    body.offer_id,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!(await verifyBelongsToOrg(supabase, "items", body.item_id, auth.orgId, auth.isSuperadmin))) {
    return NextResponse.json({ error: "item_id does not belong to this org" }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema("billing")
    .from("offer_items")
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// No PUT: offer_items is a pure (offer_id, item_id) link with no other columns to update.

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const offerId = url.searchParams.get("offer_id")
  const itemId = url.searchParams.get("item_id")
  if (!offerId || !itemId) {
    return NextResponse.json(
      { error: 'Query params "offer_id" and "item_id" are required' },
      { status: 400 },
    )
  }

  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const supabase = await createClient()
  const { ok, error: verifyError } = await verifyOfferInOrg(
    supabase,
    offerId,
    auth.orgId,
    auth.isSuperadmin,
  )
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase
    .schema("billing")
    .from("offer_items")
    .delete()
    .eq("offer_id", offerId)
    .eq("item_id", itemId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
