"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchPurchasePayments,
  createPurchasePayment,
  updatePurchasePayment,
} from "@/lib/services/purchase-payments"
import type { PurchasePayment } from "@/lib/billing/types"

export function usePurchasePayments() {
  return useQuery({
    queryKey: ["purchase-payments"],
    queryFn: fetchPurchasePayments,
  })
}

export function useCreatePurchasePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<PurchasePayment>) => createPurchasePayment(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-payments"] }),
  })
}

export function useUpdatePurchasePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PurchasePayment> }) =>
      updatePurchasePayment(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-payments"] }),
  })
}

// No delete mutation: purchase payments are financial records and are
// never hard-deleted.
