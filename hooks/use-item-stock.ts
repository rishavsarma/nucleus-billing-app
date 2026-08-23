"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchItemStock } from "@/lib/services/item-stock"

export function useItemStock(itemId: string | undefined) {
  return useQuery({
    queryKey: ["item-stock", itemId],
    queryFn: () => fetchItemStock(itemId!),
    enabled: !!itemId,
  })
}
