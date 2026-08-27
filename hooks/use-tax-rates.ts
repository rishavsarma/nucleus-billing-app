"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchTaxRatesAll, fetchTaxRatesPaginated,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
} from "@/lib/database/services/tax-rates"
import type { TaxRate } from "@/lib/database/types"

/** All records — use in dropdowns/pickers where you need every option. */
export function useTaxRates() {
  return useQuery({
    queryKey: ["tax-rates", "all"],
    queryFn: fetchTaxRatesAll,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function useTaxRatesList(params: ListParams) {
  return useQuery({
    queryKey: ["tax-rates", "list", params],
    queryFn: () => fetchTaxRatesPaginated(params),
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
