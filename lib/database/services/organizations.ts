import { api } from "@/lib/axios"
import type { Organization } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch the caller's own organization — a non-superadmin only ever has
 * one, and the API resolves it server-side (no id needed). */
export async function fetchCurrentOrganization(): Promise<Organization> {
  const { data } = await api.get<Organization>("/database/organizations")
  return data
}

/** Fetch a single organization by id — for the superadmin admin org-detail
 * page, instead of pulling every org and finding it client-side. */
export async function fetchOrganizationById(id: string): Promise<Organization> {
  const { data } = await api.get<Organization>("/database/organizations", { params: { id } })
  return data
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
