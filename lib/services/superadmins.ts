import { api } from "@/lib/axios"
import type { Superadmin } from "@/lib/billing/types"

export async function fetchSuperadmins(): Promise<Superadmin[]> {
  const { data } = await api.get<Superadmin[]>("/billing/superadmins")
  return data
}

// No create/update/delete: rls-policies.sql grants only superadmins_select —
// granting/revoking superadmin is done directly against the database, never
// through the API.
