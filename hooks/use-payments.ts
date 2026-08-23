"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchPayments, createPayment, updatePayment } from "@/lib/database/services/payments"
import type { Payment } from "@/lib/database/types"

export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: fetchPayments,
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Payment>) => createPayment(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  })
}

export function useUpdatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Payment> }) =>
      updatePayment(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  })
}

// No delete mutation: payments are financial records and are never
// hard-deleted.
