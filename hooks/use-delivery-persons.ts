"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchDeliveryPersonsAll, fetchDeliveryPersonsPaginated,
  createDeliveryPerson,
  updateDeliveryPerson,
  deleteDeliveryPerson,
} from "@/lib/database/services/delivery-persons"
import type { DeliveryPerson } from "@/lib/database/types"

/** All records — use in dropdowns/pickers where you need every option. */
export function useDeliveryPersons() {
  return useQuery({
    queryKey: ["delivery-persons", "all"],
    queryFn: fetchDeliveryPersonsAll,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function useDeliveryPersonsList(params: ListParams) {
  return useQuery({
    queryKey: ["delivery-persons", "list", params],
    queryFn: () => fetchDeliveryPersonsPaginated(params),
  })
}

export function useCreateDeliveryPerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<DeliveryPerson>) => createDeliveryPerson(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["delivery-persons"] }),
  })
}

export function useUpdateDeliveryPerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<DeliveryPerson> }) =>
      updateDeliveryPerson(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["delivery-persons"] }),
  })
}

export function useDeleteDeliveryPerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDeliveryPerson(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["delivery-persons"] }),
  })
}
