"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchInvoicesAll, fetchInvoiceById, fetchInvoicesPaginated, createInvoice, updateInvoice } from "@/lib/database/services/invoices"
import type { Invoice } from "@/lib/database/types"

/** All records — use in dropdowns/pickers where you need every option. */
export function useInvoices() {
  return useQuery({
    queryKey: ["invoices", "all"],
    queryFn: fetchInvoicesAll,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function useInvoicesList(params: ListParams) {
  return useQuery({
    queryKey: ["invoices", "list", params],
    queryFn: () => fetchInvoicesPaginated(params),
  })
}

/** Single record by id — for detail pages. */
export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoices", "detail", id],
    queryFn: () => fetchInvoiceById(id),
    enabled: !!id,
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
