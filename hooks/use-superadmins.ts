"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchSuperadmins } from "@/lib/database/services/superadmins"

export function useSuperadmins() {
  return useQuery({
    queryKey: ["superadmins"],
    queryFn: fetchSuperadmins,
  })
}
