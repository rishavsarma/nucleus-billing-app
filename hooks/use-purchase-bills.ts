"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchPurchaseBills,
  createPurchaseBill,
  updatePurchaseBill,
} from "@/lib/database/services/purchase-bills"
import type { PurchaseBill } from "@/lib/database/types"

export function usePurchaseBills() {
  return useQuery({
    queryKey: ["purchase-bills"],
    queryFn: fetchPurchaseBills,
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
