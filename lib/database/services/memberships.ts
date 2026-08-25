import { api } from "@/lib/axios"
import type { Membership } from "@/lib/database/types"

export async function fetchMemberships(): Promise<Membership[]> {
  const { data } = await api.get<Membership[]>("/database/memberships")
  return data
}

export async function createMembership(input: Partial<Membership>): Promise<Membership> {
  const { data } = await api.post<Membership>("/database/memberships", input)
  return data
}

export async function updateMembership(
  id: string,
  input: Partial<Membership>,
): Promise<Membership> {
  const { data } = await api.put<Membership>("/database/memberships", input, { params: { id } })
  return data
}

export async function deleteMembership(id: string): Promise<void> {
  await api.delete("/database/memberships", { params: { id } })
}
