import { NextResponse } from "next/server"
import { requireSuperadmin } from "@/lib/database/require-org"

// GET requires the caller to already be a superadmin — this table controls
// a global privilege, not something org-scoped. There is intentionally no
// insert/update/delete path here at all: rls-policies.sql grants only
// superadmins_select, on purpose ("nobody can grant themselves this through
// the API"). The first (and every subsequent) superadmin must be inserted
// directly against the database (e.g. via the Supabase dashboard / service
// role), not through this API.

export async function GET() {
  const auth = await requireSuperadmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 403 })
  }

  const { data, error } = await auth.supabase.schema("billing").from("superadmins").select("*")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
