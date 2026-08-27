"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchStaffById,
  fetchStaffPaginated,
  createStaff,
  updateStaff,
  deleteStaff,
} from "@/lib/database/services/staff"
import type { Staff } from "@/lib/database/types"

/** Single record by id — for display, e.g. resolving a delivery's
 * assigned staff member. */
export function useStaffMember(id: string | undefined) {
  return useQuery({
    queryKey: ["staff", "detail", id],
    queryFn: () => fetchStaffById(id!),
    enabled: !!id,
  })
}

/** Paginated + searched list — use in list-view table pages, or pass role
 * to scope to one role (e.g. a delivery-person picker). */
export function useStaffList(params: ListParams & { role?: string }) {
  return useQuery({
    queryKey: ["staff", "list", params],
    queryFn: () => fetchStaffPaginated(params),
  })
}

export function useCreateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Staff>) => createStaff(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  })
}

export function useUpdateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Staff> }) => updateStaff(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  })
}

export function useDeleteStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteStaff(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  })
}
