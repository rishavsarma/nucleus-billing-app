import { api } from "@/lib/axios"
import type { Organization } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all organizations with no pagination — for dropdowns / pickers. */
export async function fetchOrganizationsAll(): Promise<Organization[]> {
  const { data } = await api.get<Organization[]>("/database/organizations", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<Organization>).data
}

/** Fetch a paginated + searched page of organizations. */
export async function fetchOrganizationsPaginated(params: ListParams): Promise<PaginatedResponse<Organization>> {
  const { data } = await api.get<PaginatedResponse<Organization>>("/database/organizations", { params })
  return data
}

export async function createOrganization(input: Partial<Organization>): Promise<Organization> {
  const { data } = await api.post<Organization>("/database/organizations", input)
  return data
}

export async function updateOrganization(
  id: string,
  input: Partial<Organization>,
): Promise<Organization> {
  const { data } = await api.put<Organization>("/database/organizations", input, {
    params: { id },
  })
  return data
}

// No delete: organizations are never hard-deleted, only deactivated
// (is_active = false via updateOrganization) — see rls-policies.sql, which
// has no delete policy for this table.
