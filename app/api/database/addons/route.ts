import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireUserId } from "@/lib/database/require-org"

// Global catalog, not org-scoped — readable by any signed-in user (and by
// anonymous requests too, per 005_delivery_and_public_pricing.sql, but this
// route only serves the authenticated app, so requireUserId() is enough).
// Writes are superadmin-only, done directly in SQL — no POST/PUT/DELETE here.
export async function GET() {
  const auth = await requireUserId()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.schema("billing").from("addons").select("*").order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
