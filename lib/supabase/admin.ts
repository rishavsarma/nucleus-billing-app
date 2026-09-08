import "server-only"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { http2Fetch } from "@/lib/http2-fetch"

// Set SUPABASE_HTTP2_FETCH=0 to fall back to Bun's plain (HTTP/1.1) fetch
// without a code change — see lib/http2-fetch.ts for why this exists.
const useHttp2Fetch = process.env.SUPABASE_HTTP2_FETCH !== "0"

/**
 * Uses the service role key, which bypasses Row Level Security.
 * Only import this in trusted server contexts (route handlers, webhooks,
 * server actions) — never in a Client Component or anything sent to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: useHttp2Fetch ? { fetch: http2Fetch } : undefined,
    }
  )
}
