"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchInvoiceById, fetchInvoicesPaginated, createInvoice, updateInvoice } from "@/lib/database/services/invoices"
import type { Invoice } from "@/lib/database/types"

/** Paginated + searched list — use in list-view table pages, or pass
 * customer_id to scope to one customer's invoices (e.g. a picker). `enabled`
 * lets a caller hold off fetching until e.g. a customer is actually chosen,
 * rather than fetching unscoped in the meantime. */
export function useInvoicesList(params: ListParams & { customer_id?: string }, enabled = true) {
  return useQuery({
    queryKey: ["invoices", "list", params],
    queryFn: () => fetchInvoicesPaginated(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Single record by id — for detail pages. */
export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoices", "detail", id],
    queryFn: () => fetchInvoiceById(id!),
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
