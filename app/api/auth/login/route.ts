import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { readJson } from "@/lib/api-response"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
})

// Two independent limiters: a loose per-IP window guards against a single
// source hammering many accounts, a tighter per-email window guards the
// one account a targeted credential-stuffing attempt actually cares about
// (and can't be starved by an attacker spreading requests across IPs).
const IP_LIMIT = 20
const EMAIL_LIMIT = 5
const WINDOW_SECONDS = 15 * 60

export async function POST(request: Request) {
  const body = await readJson(request)
  if (!body) {
    return NextResponse.json(
      { error: "Request body must be valid JSON.", code: "invalid_json" },
      { status: 400 }
    )
  }
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    const field = parsed.error.issues[0].path[0]
    const code = field === "password" ? "password_required" : "invalid_email"
    return NextResponse.json(
      { error: parsed.error.issues[0].message, code },
      { status: 400 }
    )
  }

  const ip = getClientIp(request)
  const email = parsed.data.email.toLowerCase()
  const [ipResult, emailResult] = await Promise.all([
    checkRateLimit(`login-ip:${ip}`, IP_LIMIT, WINDOW_SECONDS),
    checkRateLimit(`login-email:${email}`, EMAIL_LIMIT, WINDOW_SECONDS),
  ])
  if (!ipResult.allowed || !emailResult.allowed) {
    const retryAfterSeconds = Math.max(
      ipResult.retryAfterSeconds,
      emailResult.retryAfterSeconds
    )
    return NextResponse.json(
      {
        error: "Too many login attempts. Please try again later.",
        code: "rate_limited",
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 401 }
    )
  }

  return NextResponse.json({ user: data.user })
}
