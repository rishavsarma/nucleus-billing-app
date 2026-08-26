"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchItemVariants } from "@/lib/database/services/item-variants"

export function useItemVariants(itemId: string | undefined, warehouseId?: string) {
  return useQuery({
    queryKey: ["item-variants", itemId, warehouseId],
    queryFn: () => fetchItemVariants(itemId!, warehouseId),
    enabled: !!itemId,
  })
}
