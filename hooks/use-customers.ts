"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchCustomersAll, fetchCustomerById, fetchCustomersPaginated,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/database/services/customers"
import type { Customer } from "@/lib/database/types"

/** All records — use in dropdowns/pickers where you need every option. */
export function useCustomers() {
  return useQuery({
    queryKey: ["customers", "all"],
    queryFn: fetchCustomersAll,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function useCustomersList(params: ListParams) {
  return useQuery({
    queryKey: ["customers", "list", params],
    queryFn: () => fetchCustomersPaginated(params),
  })
}

/** Single record by id — for detail pages. */
export function useCustomer(id: string) {
  return useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => fetchCustomerById(id),
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Customer>) => createCustomer(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Customer> }) =>
      updateCustomer(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  })
}
