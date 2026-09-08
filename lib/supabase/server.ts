import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { http2Fetch } from "@/lib/http2-fetch"

// Set SUPABASE_HTTP2_FETCH=0 to fall back to Bun's plain (HTTP/1.1) fetch
// without a code change — see lib/http2-fetch.ts for why this exists.
const useHttp2Fetch = process.env.SUPABASE_HTTP2_FETCH !== "0"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // setAll called from a Server Component; safe to ignore
            // because proxy.ts refreshes the session on every request.
          }
        },
      },
      global: useHttp2Fetch ? { fetch: http2Fetch } : undefined,
    }
  )
}
