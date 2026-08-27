"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchSalesReturnById, fetchSalesReturnsPaginated, createSalesReturn, updateSalesReturn } from "@/lib/database/services/sales-returns"
import type { SalesReturn } from "@/lib/database/types"

/** Paginated + searched list — use in list-view table pages. */
export function useSalesReturnsList(params: ListParams) {
  return useQuery({
    queryKey: ["sales-returns", "list", params],
    queryFn: () => fetchSalesReturnsPaginated(params),
  })
}

/** Single record by id — for detail pages. */
export function useSalesReturn(id: string) {
  return useQuery({
    queryKey: ["sales-returns", "detail", id],
    queryFn: () => fetchSalesReturnById(id),
    enabled: !!id,
  })
}

export function useCreateSalesReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<SalesReturn>) => createSalesReturn(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales-returns"] }),
  })
}

export function useUpdateSalesReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SalesReturn> }) =>
      updateSalesReturn(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales-returns"] }),
  })
}

// No delete mutation: sales returns are financial records — cancel via
// useUpdateSalesReturn({ status: "void" }), never hard-deleted.
