"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchEnrichedSuperadmins } from "@/lib/services/superadmins-enriched"

export function useEnrichedSuperadmins() {
  return useQuery({
    queryKey: ["superadmins-enriched"],
    queryFn: fetchEnrichedSuperadmins,
  })
}
