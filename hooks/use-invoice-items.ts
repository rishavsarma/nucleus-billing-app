"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchInvoiceItems,
  createInvoiceItem,
  updateInvoiceItem,
  deleteInvoiceItem,
} from "@/lib/database/services/invoice-items"
import type { InvoiceItem } from "@/lib/database/types"

export function useInvoiceItems(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice-items", invoiceId],
    queryFn: () => fetchInvoiceItems(invoiceId!),
    enabled: !!invoiceId,
  })
}

// Every mutation here also invalidates ["invoices"] — recalc_invoice() (see
// 002_functions_triggers.sql) recomputes the parent invoice's
// subtotal/tax_total/total whenever its line items change, so the cached
// invoice list/detail would otherwise show stale totals until some other
// query happened to refetch it.

export function useCreateInvoiceItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<InvoiceItem> & { invoice_id: string }) => createInvoiceItem(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoice-items", variables.invoice_id] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
    },
  })
}

export function useUpdateInvoiceItem(invoiceId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<InvoiceItem> }) =>
      updateInvoiceItem(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-items", invoiceId] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
    },
  })
}

export function useDeleteInvoiceItem(invoiceId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvoiceItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-items", invoiceId] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
    },
  })
}
