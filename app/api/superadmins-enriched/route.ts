import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperadmin } from "@/lib/database/require-org"
import { cacheGet, cacheSet } from "@/lib/cache"

const SUPERADMINS_CACHE_TTL_SECONDS = 60
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
  const auth = await requireSuperadmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const cacheKey = "superadmins-enriched-list"
  const cached = await cacheGet(cacheKey)
  if (cached) {
    return NextResponse.json(JSON.parse(cached))
  }

  const { data: superadmins, error } = await auth.supabase
    .schema("billing")
    .from("superadmins")
    .select("*")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = createAdminClient()
  const enriched = await Promise.all(
    (superadmins ?? []).map(async (superadmin) => {
      const email = await getUserEmail(admin, superadmin.user_id)
      return { ...superadmin, email }
    }),
  )

  await cacheSet(cacheKey, JSON.stringify(enriched), SUPERADMINS_CACHE_TTL_SECONDS)

  return NextResponse.json(enriched)
}
