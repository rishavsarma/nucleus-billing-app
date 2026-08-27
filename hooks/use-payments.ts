"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchPaymentsByInvoiceId, fetchPaymentsPaginated, createPayment, updatePayment } from "@/lib/database/services/payments"
import type { Payment } from "@/lib/database/types"

/** One invoice's payment history — for the invoice detail page. */
export function usePaymentsByInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["payments", "by-invoice", invoiceId],
    queryFn: () => fetchPaymentsByInvoiceId(invoiceId!),
    enabled: !!invoiceId,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function usePaymentsList(params: ListParams) {
  return useQuery({
    queryKey: ["payments", "list", params],
    queryFn: () => fetchPaymentsPaginated(params),
  })
}

// Also invalidates ["invoices"]: recalc_invoice() (see
// 002_functions_triggers.sql) recomputes amount_paid/status on the parent
// invoice whenever its payments change.

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Payment>) => createPayment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      // A payment against an installment flips that installment to "paid"
      // via the payments_mark_installment_paid DB trigger — refetch so the
      // EMI schedule and the org-wide Installments list catch up.
      queryClient.invalidateQueries({ queryKey: ["installments"] })
    },
  })
}

export function useUpdatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Payment> }) =>
      updatePayment(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
    },
  })
}

// No delete mutation: payments are financial records and are never
// hard-deleted.
