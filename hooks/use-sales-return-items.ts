"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchSalesReturnItems,
  createSalesReturnItem,
  updateSalesReturnItem,
  deleteSalesReturnItem,
} from "@/lib/database/services/sales-return-items"
import type { SalesReturnItem } from "@/lib/database/types"

export function useSalesReturnItems(salesReturnId: string | undefined) {
  return useQuery({
    queryKey: ["sales-return-items", salesReturnId],
    queryFn: () => fetchSalesReturnItems(salesReturnId!),
    enabled: !!salesReturnId,
  })
}

// Also invalidates ["sales-returns"]: recalc_sales_return() recomputes the
// parent's subtotal/tax_total/total whenever its line items change.

export function useCreateSalesReturnItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<SalesReturnItem> & { sales_return_id: string }) =>
      createSalesReturnItem(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sales-return-items", variables.sales_return_id] })
      queryClient.invalidateQueries({ queryKey: ["sales-returns"] })
    },
  })
}

export function useUpdateSalesReturnItem(salesReturnId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SalesReturnItem> }) =>
      updateSalesReturnItem(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-return-items", salesReturnId] })
      queryClient.invalidateQueries({ queryKey: ["sales-returns"] })
    },
  })
}

export function useDeleteSalesReturnItem(salesReturnId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSalesReturnItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-return-items", salesReturnId] })
      queryClient.invalidateQueries({ queryKey: ["sales-returns"] })
    },
  })
}
