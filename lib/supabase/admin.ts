import "server-only"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

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
    },
  )
}
