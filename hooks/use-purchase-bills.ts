"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchPurchaseBillsAll, fetchPurchaseBillById, fetchPurchaseBillsPaginated,
  createPurchaseBill,
  updatePurchaseBill,
} from "@/lib/database/services/purchase-bills"
import type { PurchaseBill } from "@/lib/database/types"

/** All records — use in dropdowns/pickers where you need every option. */
export function usePurchaseBills() {
  return useQuery({
    queryKey: ["purchase-bills", "all"],
    queryFn: fetchPurchaseBillsAll,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function usePurchaseBillsList(params: ListParams) {
  return useQuery({
    queryKey: ["purchase-bills", "list", params],
    queryFn: () => fetchPurchaseBillsPaginated(params),
  })
}

/** Single record by id — for detail pages. */
export function usePurchaseBill(id: string) {
  return useQuery({
    queryKey: ["purchase-bills", "detail", id],
    queryFn: () => fetchPurchaseBillById(id),
    enabled: !!id,
  })
}

export function useCreatePurchaseBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<PurchaseBill>) => createPurchaseBill(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-bills"] }),
  })
}

export function useUpdatePurchaseBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PurchaseBill> }) =>
      updatePurchaseBill(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-bills"] }),
  })
}

// No delete mutation: purchase bills are financial records — cancel via
// useUpdatePurchaseBill({ status: "void" }), never hard-deleted.
