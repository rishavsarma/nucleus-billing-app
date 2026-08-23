"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchPurchaseBillItems,
  createPurchaseBillItem,
  updatePurchaseBillItem,
  deletePurchaseBillItem,
} from "@/lib/database/services/purchase-bill-items"
import type { PurchaseBillItem } from "@/lib/database/types"

export function usePurchaseBillItems(purchaseBillId: string | undefined) {
  return useQuery({
    queryKey: ["purchase-bill-items", purchaseBillId],
    queryFn: () => fetchPurchaseBillItems(purchaseBillId!),
    enabled: !!purchaseBillId,
  })
}

export function useCreatePurchaseBillItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<PurchaseBillItem> & { purchase_bill_id: string }) =>
      createPurchaseBillItem(input),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({
        queryKey: ["purchase-bill-items", variables.purchase_bill_id],
      }),
  })
}

export function useUpdatePurchaseBillItem(purchaseBillId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PurchaseBillItem> }) =>
      updatePurchaseBillItem(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["purchase-bill-items", purchaseBillId] }),
  })
}

export function useDeletePurchaseBillItem(purchaseBillId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePurchaseBillItem(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["purchase-bill-items", purchaseBillId] }),
  })
}
