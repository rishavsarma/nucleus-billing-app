"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchStockMovementsAll, fetchStockMovementsPaginated, createStockMovement } from "@/lib/database/services/stock-movements"
import type { StockMovement } from "@/lib/database/types"

/** All records — use in dropdowns/pickers where you need every option. */
export function useStockMovements() {
  return useQuery({
    queryKey: ["stock-movements", "all"],
    queryFn: fetchStockMovementsAll,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function useStockMovementsList(params: ListParams) {
  return useQuery({
    queryKey: ["stock-movements", "list", params],
    queryFn: () => fetchStockMovementsPaginated(params),
  })
}

export function useCreateStockMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<StockMovement>) => createStockMovement(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
  })
}

// No update/delete mutations: stock_movements is an append-only ledger —
// corrections are offsetting rows (another useCreateStockMovement call),
// never edits.
