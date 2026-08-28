import { NextResponse } from "next/server"
import { requireOrgId, verifyBelongsToOrg, type SupabaseClient } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

const OFFER_ITEMS_CACHE_TTL_SECONDS = 180

function offerItemsCacheKey(orgId: string, offerId: string) {
  return `offer-items:${orgId}:${offerId}`
}

async function verifyOfferInOrg(
  supabase: SupabaseClient,
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

  if (!auth.isSuperadmin) {
    const cached = await cacheGet(offerItemsCacheKey(auth.orgId!, offerId))
    if (cached) return NextResponse.json(JSON.parse(cached))
  }

  const supabase = auth.supabase
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

  if (!auth.isSuperadmin) {
    await cacheSet(offerItemsCacheKey(auth.orgId!, offerId), JSON.stringify(data ?? []), OFFER_ITEMS_CACHE_TTL_SECONDS)
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
  if (!body.offer_id || !body.item_id) {
    return NextResponse.json(
      { error: '"offer_id" and "item_id" are required' },
      { status: 400 },
    )
  }

  const supabase = auth.supabase
  const [offerCheck, itemCheck] = await Promise.all([
    verifyOfferInOrg(supabase, body.offer_id, auth.orgId, auth.isSuperadmin),
    verifyBelongsToOrg(supabase, "items", body.item_id, auth.orgId, auth.isSuperadmin),
  ])

  if (offerCheck.error) return NextResponse.json({ error: offerCheck.error.message }, { status: 500 })
  if (!offerCheck.ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!itemCheck) return NextResponse.json({ error: "item_id does not belong to this org" }, { status: 400 })

  const { data, error } = await supabase
    .schema("billing")
    .from("offer_items")
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (auth.orgId) {
    await Promise.all([
      cacheDel(offerItemsCacheKey(auth.orgId, body.offer_id)),
      cacheDel(`offer:${auth.orgId}:${body.offer_id}`),
    ])
  }

  return NextResponse.json(data, { status: 201 })
}

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

  const supabase = auth.supabase
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

  if (auth.orgId) {
    await Promise.all([
      cacheDel(offerItemsCacheKey(auth.orgId, offerId)),
      cacheDel(`offer:${auth.orgId}:${offerId}`),
    ])
  }

  return new NextResponse(null, { status: 204 })
}
