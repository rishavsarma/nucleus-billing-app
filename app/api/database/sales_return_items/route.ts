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
  verifyChildBelongsToOrg,
  type SupabaseClient,
} from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

const RETURN_ITEMS_CACHE_TTL_SECONDS = 120

function salesReturnItemsCacheKey(orgId: string, salesReturnId: string) {
  return `sales-return-items:${orgId}:${salesReturnId}`
}

async function verifySalesReturnInOrg(
  supabase: SupabaseClient,
  salesReturnId: string,
  orgId: string | null,
  isSuperadmin: boolean
) {
  let query = supabase
    .schema("billing")
    .from("sales_returns")
    .select("id")
    .eq("id", salesReturnId)
  if (!isSuperadmin) query = query.eq("org_id", orgId!)
  const { data, error } = await query.maybeSingle()
  return { ok: !error && !!data, error }
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const salesReturnId = new URL(request.url).searchParams.get("sales_return_id")
  if (!salesReturnId) {
    return NextResponse.json(
      { error: 'Query param "sales_return_id" is required' },
      { status: 400 }
    )
  }

  if (!auth.isSuperadmin) {
    const cached = await cacheGet(
      salesReturnItemsCacheKey(auth.orgId!, salesReturnId)
    )
    if (cached) return NextResponse.json(JSON.parse(cached))
  }

  const supabase = auth.supabase
  const { ok, error: verifyError } = await verifySalesReturnInOrg(
    supabase,
    salesReturnId,
    auth.orgId,
    auth.isSuperadmin
  )
  if (verifyError) return dbError(verifyError, "sales_return_items:GET")
  if (!ok) return notFound()

  const { data, error } = await supabase
    .schema("billing")
    .from("sales_return_items")
    .select("*")
    .eq("sales_return_id", salesReturnId)

  if (error) return dbError(error, "sales_return_items:GET")

  if (!auth.isSuperadmin) {
    await cacheSet(
      salesReturnItemsCacheKey(auth.orgId!, salesReturnId),
      JSON.stringify(data ?? []),
      RETURN_ITEMS_CACHE_TTL_SECONDS
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
  if (!body.sales_return_id) {
    return NextResponse.json(
      { error: '"sales_return_id" is required' },
      { status: 400 }
    )
  }

  const supabase = auth.supabase
  const [retCheck, itemCheck, invoiceItemCheck] = await Promise.all([
    verifySalesReturnInOrg(
      supabase,
      body.sales_return_id,
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
    body.invoice_item_id
      ? verifyChildBelongsToOrg(
          supabase,
          "invoice_items",
          body.invoice_item_id,
          "invoice_id",
          "invoices",
          auth.orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
  ])

  if (retCheck.error)
    return NextResponse.json({ error: retCheck.error.message }, { status: 500 })
  if (!retCheck.ok) return notFound()
  if (!itemCheck)
    return NextResponse.json(
      { error: "item_id does not belong to this org" },
      { status: 400 }
    )
  if (!invoiceItemCheck)
    return NextResponse.json(
      { error: "invoice_item_id does not belong to this org" },
      { status: 400 }
    )

  const { data, error } = await supabase
    .schema("billing")
    .from("sales_return_items")
    .insert(pickAllowed("sales_return_items", body))
    .select()
    .single()

  if (error) return dbError(error, "sales_return_items:POST")

  if (auth.orgId) {
    await Promise.all([
      cacheDel(salesReturnItemsCacheKey(auth.orgId, body.sales_return_id)),
      cacheDel(`sales-return:${auth.orgId}:${body.sales_return_id}`),
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
    .from("sales_return_items")
    .select("sales_return_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return dbError(existingError, "sales_return_items:PUT")
  if (!existing) return notFound()

  const { ok, error: verifyError } = await verifySalesReturnInOrg(
    supabase,
    existing.sales_return_id,
    auth.orgId,
    auth.isSuperadmin
  )
  if (verifyError) return dbError(verifyError, "sales_return_items:PUT")
  if (!ok) return notFound()

  const body = await readJson(request)
  if (!body)
    return badRequest("invalid_json", "Request body must be valid JSON.")
  const [itemCheck, invoiceItemCheck] = await Promise.all([
    body.item_id
      ? verifyBelongsToOrg(
          supabase,
          "items",
          body.item_id,
          auth.orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
    body.invoice_item_id
      ? verifyChildBelongsToOrg(
          supabase,
          "invoice_items",
          body.invoice_item_id,
          "invoice_id",
          "invoices",
          auth.orgId,
          auth.isSuperadmin
        )
      : Promise.resolve(true),
  ])
  if (!itemCheck)
    return NextResponse.json(
      { error: "item_id does not belong to this org" },
      { status: 400 }
    )
  if (!invoiceItemCheck)
    return NextResponse.json(
      { error: "invoice_item_id does not belong to this org" },
      { status: 400 }
    )

  const { data, error } = await supabase
    .schema("billing")
    .from("sales_return_items")
    .update(pickAllowed("sales_return_items", body))
    .eq("id", id)
    .select()
    .maybeSingle()

  if (error) return dbError(error, "sales_return_items:PUT")
  if (!data) return notFound()

  if (auth.orgId) {
    await Promise.all([
      cacheDel(salesReturnItemsCacheKey(auth.orgId, existing.sales_return_id)),
      cacheDel(`sales-return:${auth.orgId}:${existing.sales_return_id}`),
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
    .from("sales_return_items")
    .select("sales_return_id")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return dbError(existingError, "sales_return_items:DELETE")
  if (!existing) return notFound()

  const { ok, error: verifyError } = await verifySalesReturnInOrg(
    supabase,
    existing.sales_return_id,
    auth.orgId,
    auth.isSuperadmin
  )
  if (verifyError) return dbError(verifyError, "sales_return_items:DELETE")
  if (!ok) return notFound()

  const { error } = await supabase
    .schema("billing")
    .from("sales_return_items")
    .delete()
    .eq("id", id)
  if (error) return dbError(error, "sales_return_items:DELETE")

  if (auth.orgId) {
    await Promise.all([
      cacheDel(salesReturnItemsCacheKey(auth.orgId, existing.sales_return_id)),
      cacheDel(`sales-return:${auth.orgId}:${existing.sales_return_id}`),
    ])
  }

  return new NextResponse(null, { status: 204 })
}
