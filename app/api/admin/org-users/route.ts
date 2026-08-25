import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperadmin } from "@/lib/database/require-org"

// Superadmin-only bootstrap path for a brand-new organization's first user:
// billing.memberships.user_id is a hard FK into auth.users, so linking a
// membership to someone who doesn't have an account yet requires actually
// creating that account first — there's no other way to get a usable
// user_id. This creates the auth user with a generated temporary password
// (returned once, never stored) and the org membership in one request.
function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url")
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 403 })
  }

  const body = await request.json()
  const { orgId, email, role } = body as { orgId?: string; email?: string; role?: string }
  if (!orgId || !email || !role) {
    return NextResponse.json({ error: '"orgId", "email" and "role" are required' }, { status: 400 })
  }
  if (!["owner", "admin", "member"].includes(role)) {
    return NextResponse.json({ error: 'Invalid "role"' }, { status: 400 })
  }

  const admin = createAdminClient()
  const temporaryPassword = generateTemporaryPassword()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  })
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "Failed to create user" }, { status: 400 })
  }

  const { error: membershipError } = await admin
    .schema("billing")
    .from("memberships")
    .insert({ org_id: orgId, user_id: created.user.id, role })

  if (membershipError) {
    // Roll back the auth user so a failed membership insert doesn't leave an
    // orphaned account with no org access and no way to reach it again.
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: membershipError.message }, { status: 500 })
  }

  return NextResponse.json(
    { userId: created.user.id, email, temporaryPassword },
    { status: 201 },
  )
}
