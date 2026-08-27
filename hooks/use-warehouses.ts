"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchWarehousesAll, fetchWarehousesPaginated,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "@/lib/database/services/warehouses"
import type { Warehouse } from "@/lib/database/types"

/** All records — use in dropdowns/pickers where you need every option. */
export function useWarehouses() {
  return useQuery({
    queryKey: ["warehouses", "all"],
    queryFn: fetchWarehousesAll,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function useWarehousesList(params: ListParams) {
  return useQuery({
    queryKey: ["warehouses", "list", params],
    queryFn: () => fetchWarehousesPaginated(params),
  })
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Warehouse>) => createWarehouse(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  })
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Warehouse> }) =>
      updateWarehouse(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  })
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWarehouse(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  })
}
