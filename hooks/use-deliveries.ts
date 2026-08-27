"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchDeliveryByInvoiceId, createDelivery, updateDelivery } from "@/lib/database/services/deliveries"
import type { Delivery } from "@/lib/database/types"

/** The one delivery tied to an invoice, if any — for the POS and the invoice detail page. */
export function useDeliveryByInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["deliveries", "by-invoice", invoiceId],
    queryFn: () => fetchDeliveryByInvoiceId(invoiceId!),
    enabled: !!invoiceId,
  })
}

export function useCreateDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Delivery> & { invoice_id: string }) => createDelivery(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deliveries", "by-invoice", variables.invoice_id] })
    },
  })
}

export function useUpdateDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Delivery> }) => updateDelivery(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["deliveries", "by-invoice", data.invoice_id] })
    },
  })
}
