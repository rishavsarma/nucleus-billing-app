import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperadmin } from "@/lib/database/require-org"

export async function GET() {
  const auth = await requireSuperadmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const supabase = await createClient()
  const { data: superadmins, error } = await supabase.schema("billing").from("superadmins").select("*")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = createAdminClient()
  const enriched = await Promise.all(
    superadmins.map(async (superadmin) => {
      const { data } = await admin.auth.admin.getUserById(superadmin.user_id)
      return { ...superadmin, email: data?.user?.email ?? null }
    }),
  )

  return NextResponse.json(enriched)
}
