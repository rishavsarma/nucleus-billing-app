import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    const field = parsed.error.issues[0].path[0]
    const code = field === "password" ? "password_required" : "invalid_email"
    return NextResponse.json(
      { error: parsed.error.issues[0].message, code },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 401 })
  }

  return NextResponse.json({ user: data.user })
}
