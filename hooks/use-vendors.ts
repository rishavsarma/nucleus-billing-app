"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchVendorById, fetchVendorsPaginated,
  createVendor,
  updateVendor,
  deleteVendor,
} from "@/lib/database/services/vendors"
import type { Vendor } from "@/lib/database/types"

/** Paginated + searched list — use in list-view table pages. */
export function useVendorsList(params: ListParams) {
  return useQuery({
    queryKey: ["vendors", "list", params],
    queryFn: () => fetchVendorsPaginated(params),
  })
}

/** Single record by id — for detail pages. */
export function useVendor(id: string | undefined) {
  return useQuery({
    queryKey: ["vendors", "detail", id],
    queryFn: () => fetchVendorById(id!),
    enabled: !!id,
  })
}

export function useCreateVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Vendor>) => createVendor(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  })
}

export function useUpdateVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Vendor> }) =>
      updateVendor(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  })
}

export function useDeleteVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVendor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  })
}
