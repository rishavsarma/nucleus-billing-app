"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchItemStock, fetchItemStockPaginated } from "@/lib/database/services/item-stock"
import type { ListParams } from "@/lib/database/list-params-types"

export function useItemStock(itemId: string | undefined) {
  return useQuery({
    queryKey: ["item-stock", itemId],
    queryFn: () => fetchItemStock(itemId!),
    enabled: !!itemId,
  })
}

/** Paginated + searched list — use on the Stock list page. */
export function useItemStockList(params: ListParams) {
  return useQuery({
    queryKey: ["item-stock", "list", params],
    queryFn: () => fetchItemStockPaginated(params),
  })
}
