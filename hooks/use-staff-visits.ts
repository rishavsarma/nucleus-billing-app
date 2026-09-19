"use client"

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  createStaffVisit,
  deleteStaffVisit,
  fetchStaffVisitsPaginated,
  updateStaffVisit,
  type StaffVisitListParams,
} from "@/lib/database/services/staff-visits"
import type { StaffVisit } from "@/lib/database/types"

export function useStaffVisitsList(params: StaffVisitListParams) {
  return useQuery({
    queryKey: ["staff-visits", "list", params],
    queryFn: () => fetchStaffVisitsPaginated(params),
    placeholderData: keepPreviousData,
  })
}

export function useCreateStaffVisit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<StaffVisit>) => createStaffVisit(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["staff-visits"] }),
  })
}

export function useUpdateStaffVisit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<StaffVisit> }) =>
      updateStaffVisit(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["staff-visits"] }),
  })
}

export function useDeleteStaffVisit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteStaffVisit(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["staff-visits"] }),
  })
}
