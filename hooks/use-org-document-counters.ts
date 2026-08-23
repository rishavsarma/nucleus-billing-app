"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchOrgDocumentCounters } from "@/lib/database/services/org-document-counters"

export function useOrgDocumentCounters() {
  return useQuery({
    queryKey: ["org-document-counters"],
    queryFn: fetchOrgDocumentCounters,
  })
}
