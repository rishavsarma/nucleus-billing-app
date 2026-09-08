import { NextResponse } from "next/server"
import { dbError } from "@/lib/api-response"
import { requireUserId } from "@/lib/database/require-org"
import { cacheGet, cacheSet } from "@/lib/cache"

const ADDONS_CACHE_KEY = "global:addons:list"
const ADDONS_TTL_SECONDS = 600

// Global catalog, not org-scoped — readable by any signed-in user.
// Cached in Redis for 10 minutes.
export async function GET() {
  const auth = await requireUserId()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const cached = await cacheGet(ADDONS_CACHE_KEY)
  if (cached) return NextResponse.json(JSON.parse(cached))

  const { data, error } = await auth.supabase
    .schema("billing")
    .from("addons")
    .select("*")
    .order("name")

  if (error) return dbError(error, "addons:GET")
  await cacheSet(
    ADDONS_CACHE_KEY,
    JSON.stringify(data ?? []),
    ADDONS_TTL_SECONDS
  )
  return NextResponse.json(data)
}
