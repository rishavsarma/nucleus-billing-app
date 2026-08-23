import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireOrgId } from "@/lib/billing/require-org"

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const supabase = await createClient()
  let query = supabase.schema("billing").from("org_document_counters").select("*")
  if (auth.isSuperadmin) {
    // Optional filter for superadmins browsing one org; omit to see every org's counters.
    const orgId = new URL(request.url).searchParams.get("org_id")
    if (orgId) query = query.eq("org_id", orgId)
  } else {
    query = query.eq("org_id", auth.orgId)
  }
  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// No POST/PUT/DELETE: org_document_counters is internal bookkeeping,
// read-only from the API (see rls-policies.sql, which grants only
// org_document_counters_select). Counters are advanced exclusively by
// billing.next_document_number(), called from the document-numbering
// triggers in functions-trigger.sql.
