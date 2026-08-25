"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchOrgMembers } from "@/lib/services/org-members"

export function useOrgMembers() {
  return useQuery({
    queryKey: ["org-members"],
    queryFn: fetchOrgMembers,
  })
}
