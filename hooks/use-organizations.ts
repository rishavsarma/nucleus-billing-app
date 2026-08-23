"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchOrganizations,
  createOrganization,
  updateOrganization,
} from "@/lib/services/organizations"
import type { Organization } from "@/lib/billing/types"

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
  })
}

export function useCreateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Organization>) => createOrganization(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations"] }),
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Organization> }) =>
      updateOrganization(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations"] }),
  })
}

// No delete mutation: organizations are never hard-deleted, only
// deactivated via useUpdateOrganization({ is_active: false }).
