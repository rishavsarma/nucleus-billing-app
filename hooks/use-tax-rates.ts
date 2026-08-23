"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchTaxRates,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
} from "@/lib/database/services/tax-rates"
import type { TaxRate } from "@/lib/database/types"

export function useTaxRates() {
  return useQuery({
    queryKey: ["tax-rates"],
    queryFn: fetchTaxRates,
  })
}

export function useCreateTaxRate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<TaxRate>) => createTaxRate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax-rates"] }),
  })
}

export function useUpdateTaxRate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TaxRate> }) =>
      updateTaxRate(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax-rates"] }),
  })
}

export function useDeleteTaxRate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTaxRate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax-rates"] }),
  })
}
