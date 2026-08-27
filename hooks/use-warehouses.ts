"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchWarehouseById, fetchWarehousesPaginated,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "@/lib/database/services/warehouses"
import type { Warehouse } from "@/lib/database/types"

/** Single record by id — for detail pages. */
export function useWarehouse(id: string | undefined) {
  return useQuery({
    queryKey: ["warehouses", "detail", id],
    queryFn: () => fetchWarehouseById(id!),
    enabled: !!id,
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
