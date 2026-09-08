import { NextResponse } from "next/server"
import { pickAllowed } from "@/lib/database/allowed-fields"
import {
  authError,
  badRequest,
  dbError,
  notFound,
  readJson,
} from "@/lib/api-response"
import {
  requireOrgId,
  verifyBelongsToOrg,
  type SupabaseClient,
} from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

const BILL_ITEMS_CACHE_TTL_SECONDS = 120

function billItemsCacheKey(orgId: string, purchaseBillId: string) {
  return `purchase-bill-items:${orgId}:${purchaseBillId}`
}

async function verifyPurchaseBillInOrg(
  supabase: SupabaseClient,
  purchaseBillId: string,
  orgId: string | null,
  isSuperadmin: boolean
) {
  let query = supabase
    .schema("billing")
    .from("purchase_bills")
    .select("id")
    .eq("id", purchaseBillId)
  if (!isSuperadmin) query = query.eq("org_id", orgId!)
  const { data, error } = await query.maybeSingle()
  return { ok: !error && !!data, error }
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const purchaseBillId = new URL(request.url).searchParams.get(
    "purchase_bill_id"
  )
  if (!purchaseBillId) {
    return NextResponse.json(
      { error: 'Query param "purchase_bill_id" is required' },
      { status: 400 }
    )
  }

  if (!auth.isSuperadmin) {
    const cached = await cacheGet(
      billItemsCacheKey(auth.orgId!, purchaseBillId)
    )
    if (cached) return NextResponse.json(JSON.parse(cached))
  }

  const supabase = auth.supabase
  const { ok, error: verifyError } = await verifyPurchaseBillInOrg(
    supabase,
    purchaseBillId,
    auth.orgId,
    auth.isSuperadmin
  )
  if (verifyError) return dbError(verifyError, "purchase_bill_items:GET")
  if (!ok) return notFound()

  const { data, error } = await supabase
    .schema("billing")
    .from("purchase_bill_items")
    .select("*")
    .eq("purchase_bill_id", purchaseBillId)

  if (error) return dbError(error, "purchase_bill_items:GET")

  if (!auth.isSuperadmin) {
    await cacheSet(
      billItemsCacheKey(auth.orgId!, purchaseBillId),
      JSON.stringify(data ?? []),
      BILL_ITEMS_CACHE_TTL_SECONDS
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
  if (!body.purchase_bill_id) {
    return NextResponse.json(
      { error: '"purchase_bill_id" is required' },
      { status: 400 }
    )
  }

  const supabase = auth.supabase
  const [billCheck, itemCheck] = await Promise.all([
    verifyPurchaseBillInOrg(
      supabase,
      body.purchase_bill_id,
      auth.orgId,
      auth.isSuperadmin
    ),
    body.item_id
      ? verifyBelongsToOrg(
          supabase,
          "items",
          body.item_id,
          auth.orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
  ])

  if (billCheck.error)
    return NextResponse.json(
      { error: billCheck.error.message },
      { status: 500 }
    )
  if (!billCheck.ok) return notFound()
  if (!itemCheck)
    return NextResponse.json(
      { error: "item_id does not belong to this org" },
      { status: 400 }
    )

  const { data, error } = await supabase
    .schema("billing")
    .from("purchase_bill_items")
    .insert(pickAllowed("purchase_bill_items", body))
    .select()
    .single()

  if (error) return dbError(error, "purchase_bill_items:POST")

  if (auth.orgId) {
    await Promise.all([
      cacheDel(billItemsCacheKey(auth.orgId, body.purchase_bill_id)),
      cacheDel(`purchase-bill:${auth.orgId}:${body.purchase_bill_id}`),
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
    .from("purchase_bill_items")
    .select("purchase_bill_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return dbError(existingError, "purchase_bill_items:PUT")
  if (!existing) return notFound()

  const { ok, error: verifyError } = await verifyPurchaseBillInOrg(
    supabase,
    existing.purchase_bill_id,
    auth.orgId,
    auth.isSuperadmin
  )
  if (verifyError) return dbError(verifyError, "purchase_bill_items:PUT")
  if (!ok) return notFound()

  const body = await readJson(request)
  if (!body)
    return badRequest("invalid_json", "Request body must be valid JSON.")
  // Re-verified on PUT as well as POST (audit NB-05) — RLS here only checks
  // the parent bill's org, never the item's.
  if (
    body.item_id &&
    !(await verifyBelongsToOrg(
      supabase,
      "items",
      body.item_id,
      auth.orgId,
      auth.isSuperadmin
    ))
  ) {
    return badRequest("invalid_item_id", "item_id does not belong to this org")
  }
  const { data, error } = await supabase
    .schema("billing")
    .from("purchase_bill_items")
    .update(pickAllowed("purchase_bill_items", body))
    .eq("id", id)
    .select()
    .maybeSingle()

  if (error) return dbError(error, "purchase_bill_items:PUT")
  if (!data) return notFound()

  if (auth.orgId) {
    await Promise.all([
      cacheDel(billItemsCacheKey(auth.orgId, existing.purchase_bill_id)),
      cacheDel(`purchase-bill:${auth.orgId}:${existing.purchase_bill_id}`),
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
    .from("purchase_bill_items")
    .select("purchase_bill_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return dbError(existingError, "purchase_bill_items:DELETE")
  if (!existing) return notFound()

  const { ok, error: verifyError } = await verifyPurchaseBillInOrg(
    supabase,
    existing.purchase_bill_id,
    auth.orgId,
    auth.isSuperadmin
  )
  if (verifyError) return dbError(verifyError, "purchase_bill_items:DELETE")
  if (!ok) return notFound()

  const { error } = await supabase
    .schema("billing")
    .from("purchase_bill_items")
    .delete()
    .eq("id", id)
  if (error) return dbError(error, "purchase_bill_items:DELETE")

  if (auth.orgId) {
    await Promise.all([
      cacheDel(billItemsCacheKey(auth.orgId, existing.purchase_bill_id)),
      cacheDel(`purchase-bill:${auth.orgId}:${existing.purchase_bill_id}`),
    ])
  }

  return new NextResponse(null, { status: 204 })
}
