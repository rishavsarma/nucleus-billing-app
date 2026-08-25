"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchMe } from "@/lib/services/me"

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 5 * 60 * 1000,
  })
}
