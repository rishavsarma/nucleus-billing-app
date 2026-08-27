"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchPurchaseReturnsAll, fetchPurchaseReturnById, fetchPurchaseReturnsPaginated,
  createPurchaseReturn,
  updatePurchaseReturn,
} from "@/lib/database/services/purchase-returns"
import type { PurchaseReturn } from "@/lib/database/types"

/** All records — use in dropdowns/pickers where you need every option. */
export function usePurchaseReturns() {
  return useQuery({
    queryKey: ["purchase-returns", "all"],
    queryFn: fetchPurchaseReturnsAll,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function usePurchaseReturnsList(params: ListParams) {
  return useQuery({
    queryKey: ["purchase-returns", "list", params],
    queryFn: () => fetchPurchaseReturnsPaginated(params),
  })
}

/** Single record by id — for detail pages. */
export function usePurchaseReturn(id: string) {
  return useQuery({
    queryKey: ["purchase-returns", "detail", id],
    queryFn: () => fetchPurchaseReturnById(id),
    enabled: !!id,
  })
}

export function useCreatePurchaseReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<PurchaseReturn>) => createPurchaseReturn(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-returns"] }),
  })
}

export function useUpdatePurchaseReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PurchaseReturn> }) =>
      updatePurchaseReturn(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-returns"] }),
  })
}

// No delete mutation: purchase returns are financial records — cancel via
// useUpdatePurchaseReturn({ status: "void" }), never hard-deleted.
