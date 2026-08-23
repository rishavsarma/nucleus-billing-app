"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchInvoiceItems,
  createInvoiceItem,
  updateInvoiceItem,
  deleteInvoiceItem,
} from "@/lib/services/invoice-items"
import type { InvoiceItem } from "@/lib/billing/types"

export function useInvoiceItems(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice-items", invoiceId],
    queryFn: () => fetchInvoiceItems(invoiceId!),
    enabled: !!invoiceId,
  })
}

export function useCreateInvoiceItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<InvoiceItem> & { invoice_id: string }) => createInvoiceItem(input),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["invoice-items", variables.invoice_id] }),
  })
}

export function useUpdateInvoiceItem(invoiceId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<InvoiceItem> }) =>
      updateInvoiceItem(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice-items", invoiceId] }),
  })
}

export function useDeleteInvoiceItem(invoiceId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvoiceItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice-items", invoiceId] }),
  })
}
