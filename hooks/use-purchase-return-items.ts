"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchPurchaseReturnItems,
  createPurchaseReturnItem,
  updatePurchaseReturnItem,
  deletePurchaseReturnItem,
} from "@/lib/database/services/purchase-return-items"
import type { PurchaseReturnItem } from "@/lib/database/types"

export function usePurchaseReturnItems(purchaseReturnId: string | undefined) {
  return useQuery({
    queryKey: ["purchase-return-items", purchaseReturnId],
    queryFn: () => fetchPurchaseReturnItems(purchaseReturnId!),
    enabled: !!purchaseReturnId,
  })
}

// Also invalidates ["purchase-returns"]: recalc_purchase_return()
// recomputes the parent's subtotal/tax_total/total whenever its line items
// change.

export function useCreatePurchaseReturnItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<PurchaseReturnItem> & { purchase_return_id: string }) =>
      createPurchaseReturnItem(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-return-items", variables.purchase_return_id] })
      queryClient.invalidateQueries({ queryKey: ["purchase-returns"] })
    },
  })
}

export function useUpdatePurchaseReturnItem(purchaseReturnId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PurchaseReturnItem> }) =>
      updatePurchaseReturnItem(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-return-items", purchaseReturnId] })
      queryClient.invalidateQueries({ queryKey: ["purchase-returns"] })
    },
  })
}

export function useDeletePurchaseReturnItem(purchaseReturnId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePurchaseReturnItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-return-items", purchaseReturnId] })
      queryClient.invalidateQueries({ queryKey: ["purchase-returns"] })
    },
  })
}
