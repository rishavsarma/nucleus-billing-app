import { api } from "@/lib/axios"
import type { Warehouse } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch a single warehouse by id — for detail pages. */
export async function fetchWarehouseById(id: string): Promise<Warehouse> {
  const { data } = await api.get<Warehouse>("/database/warehouses", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of warehouses. */
export async function fetchWarehousesPaginated(params: ListParams): Promise<PaginatedResponse<Warehouse>> {
  const { data } = await api.get<PaginatedResponse<Warehouse>>("/database/warehouses", { params })
  return data
}

export async function createWarehouse(input: Partial<Warehouse>): Promise<Warehouse> {
  const { data } = await api.post<Warehouse>("/database/warehouses", input)
  return data
}

export async function updateWarehouse(id: string, input: Partial<Warehouse>): Promise<Warehouse> {
  const { data } = await api.put<Warehouse>("/database/warehouses", input, { params: { id } })
  return data
}

export async function deleteWarehouse(id: string): Promise<void> {
  await api.delete("/database/warehouses", { params: { id } })
}
