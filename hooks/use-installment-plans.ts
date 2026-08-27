"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchInstallmentPlanByInvoiceId,
  createInstallmentPlan,
  updateInstallmentPlan,
} from "@/lib/database/services/installment-plans"
import type { InstallmentPlan } from "@/lib/database/types"

/** The one installment plan tied to an invoice, if any. */
export function useInstallmentPlanByInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["installment-plans", "by-invoice", invoiceId],
    queryFn: () => fetchInstallmentPlanByInvoiceId(invoiceId!),
    enabled: !!invoiceId,
  })
}

export function useCreateInstallmentPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<InstallmentPlan> & { invoice_id: string }) => createInstallmentPlan(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["installment-plans", "by-invoice", variables.invoice_id] })
    },
  })
}

export function useUpdateInstallmentPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<InstallmentPlan> }) => updateInstallmentPlan(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["installment-plans", "by-invoice", data.invoice_id] })
    },
  })
}
