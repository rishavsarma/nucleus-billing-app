"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchCurrentOrganization, fetchOrganizationById, fetchOrganizationsPaginated,
  createOrganization,
  updateOrganization,
} from "@/lib/database/services/organizations"
import type { Organization } from "@/lib/database/types"

/** The caller's own organization — use for "my org" everywhere (org
 * settings, subscription page, invoice PDF letterhead, the sidebar). */
export function useCurrentOrganization() {
  return useQuery({
    queryKey: ["organizations", "current"],
    queryFn: fetchCurrentOrganization,
  })
}

/** A single organization by id — for the superadmin admin org-detail page. */
export function useOrganization(id: string | undefined) {
  return useQuery({
    queryKey: ["organizations", "detail", id],
    queryFn: () => fetchOrganizationById(id!),
    enabled: !!id,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function useOrganizationsList(params: ListParams) {
  return useQuery({
    queryKey: ["organizations", "list", params],
    queryFn: () => fetchOrganizationsPaginated(params),
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
