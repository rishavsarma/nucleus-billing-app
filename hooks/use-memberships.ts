"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchMemberships,
  createMembership,
  updateMembership,
  deleteMembership,
} from "@/lib/services/memberships"
import type { Membership } from "@/lib/billing/types"

export function useMemberships() {
  return useQuery({
    queryKey: ["memberships"],
    queryFn: fetchMemberships,
  })
}

export function useCreateMembership() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Membership>) => createMembership(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memberships"] }),
  })
}

export function useUpdateMembership() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Membership> }) =>
      updateMembership(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memberships"] }),
  })
}

export function useDeleteMembership() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMembership(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memberships"] }),
  })
}
