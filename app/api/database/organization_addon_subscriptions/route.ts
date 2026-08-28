import { NextResponse } from "next/server"
import { requireOrgId, requireSuperadmin } from "@/lib/database/require-org"
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache"

const SUB_CACHE_TTL_SECONDS = 180

function subCacheKey(orgId: string) {
  return `org-addon-subs:${orgId}`
}

export async function GET() {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  if (!auth.isSuperadmin) {
    const cached = await cacheGet(subCacheKey(auth.orgId!))
    if (cached) return NextResponse.json(JSON.parse(cached))
  }

  let query = auth.supabase.schema("billing").from("organization_addon_subscriptions").select("*")
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!auth.isSuperadmin) {
    await cacheSet(subCacheKey(auth.orgId!), JSON.stringify(data ?? []), SUB_CACHE_TTL_SECONDS)
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 403 })
  }

  const body = await request.json()
  const { org_id, addon_slug } = body as { org_id?: string; addon_slug?: string }
  if (!org_id || !addon_slug) {
    return NextResponse.json({ error: '"org_id" and "addon_slug" are required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.schema("billing").rpc("subscribe_org_to_addon", {
    p_org_id: org_id,
    p_addon_slug: addon_slug,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await cacheDel(subCacheKey(org_id))
  return NextResponse.json({ id: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const auth = await requireSuperadmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 403 })
  }

  const url = new URL(request.url)
  const org_id = url.searchParams.get("org_id")
  const addon_slug = url.searchParams.get("addon_slug")
  if (!org_id || !addon_slug) {
    return NextResponse.json({ error: '"org_id" and "addon_slug" query params are required' }, { status: 400 })
  }

  const { error } = await auth.supabase.schema("billing").rpc("cancel_org_addon", {
    p_org_id: org_id,
    p_addon_slug: addon_slug,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await cacheDel(subCacheKey(org_id))
  return new NextResponse(null, { status: 204 })
}
