"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchStaffAll,
  fetchStaffPaginated,
  createStaff,
  updateStaff,
  deleteStaff,
} from "@/lib/database/services/staff"
import type { Staff } from "@/lib/database/types"

/** All records — use in dropdowns/pickers where you need every option. Optionally filter by role. */
export function useStaff(role?: string) {
  return useQuery({
    queryKey: ["staff", "all", role ?? null],
    queryFn: () => fetchStaffAll(role),
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function useStaffList(params: ListParams) {
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
