import { api } from "@/lib/axios"
import type { Vendor } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch a single record by id — for detail pages. */
export async function fetchVendorById(id: string): Promise<Vendor> {
  const { data } = await api.get<Vendor>("/database/vendors", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of vendors. */
export async function fetchVendorsPaginated(params: ListParams): Promise<PaginatedResponse<Vendor>> {
  const { data } = await api.get<PaginatedResponse<Vendor>>("/database/vendors", { params })
  return data
}

export async function createVendor(input: Partial<Vendor>): Promise<Vendor> {
  const { data } = await api.post<Vendor>("/database/vendors", input)
  return data
}

export async function updateVendor(id: string, input: Partial<Vendor>): Promise<Vendor> {
  const { data } = await api.put<Vendor>("/database/vendors", input, { params: { id } })
  return data
}

export async function deleteVendor(id: string): Promise<void> {
  await api.delete("/database/vendors", { params: { id } })
}
