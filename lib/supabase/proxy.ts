import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Refreshes the Supabase session and writes any updated auth cookies onto
 * `response`. Takes the response as a parameter (rather than creating its
 * own) so it can be composed with next-intl's middleware response in
 * middleware.ts instead of each producing a separate, conflicting one.
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Refreshes the auth token if expired. Do not run any logic between
  // createServerClient and this call, or you risk desyncing the session.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}
