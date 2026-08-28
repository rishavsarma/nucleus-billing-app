import { NextResponse } from "next/server"
import { requireOrgId, verifyBelongsToOrg } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

const DELIVERY_CACHE_TTL_SECONDS = 120

function deliveryCacheKey(orgId: string, key: string) {
  return `delivery:${orgId}:${key}`
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const invoiceId = searchParams.get("invoice_id")
  if (!id && !invoiceId) {
    return NextResponse.json(
      { error: 'Query param "id" or "invoice_id" is required' },
      { status: 400 },
    )
  }

  const lookupKey = id ? `id:${id}` : `inv:${invoiceId}`

  if (!auth.isSuperadmin) {
    const cached = await cacheGet(deliveryCacheKey(auth.orgId!, lookupKey))
    if (cached) return NextResponse.json(JSON.parse(cached))
  }

  const supabase = auth.supabase
  let query = supabase.schema("billing").from("deliveries").select("*")
  query = id ? query.eq("id", id) : query.eq("invoice_id", invoiceId!)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!auth.isSuperadmin) {
    await Promise.all([
      cacheSet(deliveryCacheKey(auth.orgId!, `id:${data.id}`), JSON.stringify(data), DELIVERY_CACHE_TTL_SECONDS),
      cacheSet(deliveryCacheKey(auth.orgId!, `inv:${data.invoice_id}`), JSON.stringify(data), DELIVERY_CACHE_TTL_SECONDS),
    ])
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
  const orgId = auth.isSuperadmin ? body.org_id : auth.orgId
  if (!orgId) {
    return NextResponse.json({ error: '"org_id" is required' }, { status: 400 })
  }
  if (!body.invoice_id) {
    return NextResponse.json({ error: '"invoice_id" is required' }, { status: 400 })
  }

  const supabase = auth.supabase
  const [invOk, staffOk] = await Promise.all([
    verifyBelongsToOrg(supabase, "invoices", body.invoice_id, orgId, auth.isSuperadmin),
    body.delivery_person_id ? verifyBelongsToOrg(supabase, "staff", body.delivery_person_id, orgId, auth.isSuperadmin) : Promise.resolve(true),
  ])

  if (!invOk) return NextResponse.json({ error: "invoice_id does not belong to this org" }, { status: 400 })
  if (!staffOk) return NextResponse.json({ error: "delivery_person_id does not belong to this org" }, { status: 400 })

  const { data, error } = await supabase
    .schema("billing")
    .from("deliveries")
    .insert({ ...body, org_id: orgId, created_by: auth.userId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

  const body = await request.json()
  const supabase = auth.supabase
  if (
    body.delivery_person_id &&
    !(await verifyBelongsToOrg(supabase, "staff", body.delivery_person_id, auth.orgId, auth.isSuperadmin))
  ) {
    return NextResponse.json({ error: "delivery_person_id does not belong to this org" }, { status: 400 })
  }

  let query = supabase.schema("billing").from("deliveries").update(body).eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await Promise.all([
    cacheDel(deliveryCacheKey(data.org_id, `id:${data.id}`)),
    cacheDel(deliveryCacheKey(data.org_id, `inv:${data.invoice_id}`)),
  ])

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
  let query = supabase.schema("billing").from("deliveries").delete().eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data) {
    await Promise.all([
      cacheDel(deliveryCacheKey(data.org_id, `id:${data.id}`)),
      cacheDel(deliveryCacheKey(data.org_id, `inv:${data.invoice_id}`)),
    ])
  }
  return new NextResponse(null, { status: 204 })
}
