import { api } from "@/lib/axios"
import type { Staff } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch a single staff member by id — for display (e.g. resolving a
 * delivery's assigned staff member) instead of pulling every row. */
export async function fetchStaffById(id: string): Promise<Staff> {
  const { data } = await api.get<Staff>("/database/staff", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of staff, optionally filtered by
 * role (e.g. delivery_person). */
export async function fetchStaffPaginated(params: ListParams & { role?: string }): Promise<PaginatedResponse<Staff>> {
  const { data } = await api.get<PaginatedResponse<Staff>>("/database/staff", { params })
  return data
}

export async function createStaff(input: Partial<Staff>): Promise<Staff> {
  const { data } = await api.post<Staff>("/database/staff", input)
  return data
}

export async function updateStaff(id: string, input: Partial<Staff>): Promise<Staff> {
  const { data } = await api.put<Staff>("/database/staff", input, { params: { id } })
  return data
}

export async function deleteStaff(id: string): Promise<void> {
  await api.delete("/database/staff", { params: { id } })
}
