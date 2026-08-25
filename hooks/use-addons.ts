"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAddons } from "@/lib/database/services/addons"

export function useAddons() {
  return useQuery({
    queryKey: ["addons"],
    queryFn: fetchAddons,
  })
}
