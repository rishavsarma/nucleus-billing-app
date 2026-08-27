import { api } from "@/lib/axios"
import type { Staff } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all staff with no pagination — for dropdowns/pickers. Optionally filter by role. */
export async function fetchStaffAll(role?: string): Promise<Staff[]> {
  const { data } = await api.get<Staff[]>("/database/staff", { params: { page: 1, pageSize: 9999, role } })
  return (data as unknown as PaginatedResponse<Staff>).data
}

/** Fetch a paginated + searched page of staff. */
export async function fetchStaffPaginated(params: ListParams): Promise<PaginatedResponse<Staff>> {
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
