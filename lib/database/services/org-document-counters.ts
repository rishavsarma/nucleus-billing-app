import { api } from "@/lib/axios"
import type { OrgDocumentCounter } from "@/lib/database/types"

export async function fetchOrgDocumentCounters(): Promise<OrgDocumentCounter[]> {
  const { data } = await api.get<OrgDocumentCounter[]>("/database/org_document_counters")
  return data
}

// No create/update/delete: org_document_counters is internal bookkeeping,
// read-only from the API (see rls-policies.sql, which grants only
// org_document_counters_select). Counters are advanced exclusively by
// billing.next_document_number(), called from the document-numbering
// triggers in functions-trigger.sql.
