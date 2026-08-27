"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchInstallmentsByPlanId, fetchInstallmentsPaginated, createInstallment } from "@/lib/database/services/installments"
import type { Installment } from "@/lib/database/types"

/** A plan's full schedule — for the invoice detail page. */
export function useInstallmentsByPlan(planId: string | undefined) {
  return useQuery({
    queryKey: ["installments", "by-plan", planId],
    queryFn: () => fetchInstallmentsByPlanId(planId!),
    enabled: !!planId,
  })
}

/** Paginated + searched list — use on the Installments list page. */
export function useInstallmentsList(params: ListParams) {
  return useQuery({
    queryKey: ["installments", "list", params],
    queryFn: () => fetchInstallmentsPaginated(params),
  })
}

export function useCreateInstallment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Installment> & { plan_id: string; invoice_id: string }) => createInstallment(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["installments", "by-plan", variables.plan_id] })
      queryClient.invalidateQueries({ queryKey: ["installments", "list"] })
    },
  })
}
