import { api } from "@/lib/axios"
import type { Organization } from "@/lib/database/types"

export async function fetchOrganizations(): Promise<Organization[]> {
  const { data } = await api.get<Organization[]>("/database/organizations")
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
