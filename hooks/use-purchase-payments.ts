"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchPurchasePayments,
  createPurchasePayment,
  updatePurchasePayment,
} from "@/lib/database/services/purchase-payments"
import type { PurchasePayment } from "@/lib/database/types"

export function usePurchasePayments() {
  return useQuery({
    queryKey: ["purchase-payments"],
    queryFn: fetchPurchasePayments,
  })
}

// Also invalidates ["purchase-bills"]: recalc_purchase_bill() (see
// 002_functions_triggers.sql) recomputes amount_paid/status on the parent
// bill whenever its payments change.

export function useCreatePurchasePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<PurchasePayment>) => createPurchasePayment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-payments"] })
      queryClient.invalidateQueries({ queryKey: ["purchase-bills"] })
    },
  })
}

export function useUpdatePurchasePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PurchasePayment> }) =>
      updatePurchasePayment(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-payments"] })
      queryClient.invalidateQueries({ queryKey: ["purchase-bills"] })
    },
  })
}

// No delete mutation: purchase payments are financial records and are
// never hard-deleted.
