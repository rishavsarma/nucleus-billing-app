"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchStockMovements, createStockMovement } from "@/lib/database/services/stock-movements"
import type { StockMovement } from "@/lib/database/types"

export function useStockMovements() {
  return useQuery({
    queryKey: ["stock-movements"],
    queryFn: fetchStockMovements,
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
