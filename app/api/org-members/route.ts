import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireOrgId } from "@/lib/database/require-org"
import { cacheGet, cacheSet } from "@/lib/cache"

const ORG_MEMBERS_CACHE_TTL_SECONDS = 120
const USER_EMAIL_CACHE_TTL_SECONDS = 300

async function getUserEmail(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const cacheKey = `user-email:${userId}`
  const cached = await cacheGet(cacheKey)
  if (cached) return cached

  const { data } = await admin.auth.admin.getUserById(userId)
  const email = data?.user?.email ?? null
  if (email) {
    await cacheSet(cacheKey, email, USER_EMAIL_CACHE_TTL_SECONDS)
  }
  return email
}

export async function GET() {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  // Superadmins aren't scoped to a single org, so there's no "my org's members" list to return here.
  if (!auth.orgId) {
    return NextResponse.json([])
  }

  const listCacheKey = `org-members:${auth.orgId}`
  const cachedList = await cacheGet(listCacheKey)
  if (cachedList) {
    return NextResponse.json(JSON.parse(cachedList))
  }

  const { data: memberships, error } = await auth.supabase
    .schema("billing")
    .from("memberships")
    .select("*")
    .eq("org_id", auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = createAdminClient()
  const enriched = await Promise.all(
    (memberships ?? []).map(async (membership) => {
      const email = await getUserEmail(admin, membership.user_id)
      return { ...membership, email }
    }),
  )

  await cacheSet(listCacheKey, JSON.stringify(enriched), ORG_MEMBERS_CACHE_TTL_SECONDS)

  return NextResponse.json(enriched)
}
