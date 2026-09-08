import { NextResponse } from "next/server"
import { authError, dbError } from "@/lib/api-response"
import { requireOrgId } from "@/lib/database/require-org"

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) {
    return authError(auth.error)
  }

  const supabase = auth.supabase
  let query = supabase
    .schema("billing")
    .from("org_document_counters")
    .select("*")
  if (auth.isSuperadmin) {
    // Optional filter for superadmins browsing one org; omit to see every org's counters.
    const orgId = new URL(request.url).searchParams.get("org_id")
    if (orgId) query = query.eq("org_id", orgId)
  } else {
    query = query.eq("org_id", auth.orgId)
  }
  const { data, error } = await query

  if (error) return dbError(error, "org_document_counters:GET")
  return NextResponse.json(data)
}

// No POST/PUT/DELETE: org_document_counters is internal bookkeeping,
// read-only from the API (see rls-policies.sql, which grants only
// org_document_counters_select). Counters are advanced exclusively by
// billing.next_document_number(), called from the document-numbering
// triggers in functions-trigger.sql.
