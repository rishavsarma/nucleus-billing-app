"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchItemVariants, fetchItemVariantsBulk } from "@/lib/database/services/item-variants"

export function useItemVariants(itemId: string | undefined, warehouseId?: string) {
  return useQuery({
    queryKey: ["item-variants", itemId, warehouseId],
    queryFn: () => fetchItemVariants(itemId!, warehouseId),
    enabled: !!itemId,
  })
}

/** Every requested item's variants in one request — use when rendering many
 * items at once instead of calling useItemVariants per item/tile. */
export function useItemVariantsBulk(itemIds: string[], warehouseId?: string) {
  return useQuery({
    queryKey: ["item-variants", "bulk", itemIds, warehouseId],
    queryFn: () => fetchItemVariantsBulk(itemIds, warehouseId),
    enabled: itemIds.length > 0,
  })
}
