"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchInvoices, createInvoice, updateInvoice } from "@/lib/services/invoices"
import type { Invoice } from "@/lib/billing/types"

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Invoice>) => createInvoice(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Invoice> }) =>
      updateInvoice(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  })
}

// No delete mutation: invoices are financial records — cancel via
// useUpdateInvoice({ status: "void" }), never hard-deleted.
