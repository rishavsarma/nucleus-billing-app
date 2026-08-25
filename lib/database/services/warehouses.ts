import { api } from "@/lib/axios"
import type { Warehouse } from "@/lib/database/types"

export async function fetchWarehouses(): Promise<Warehouse[]> {
  const { data } = await api.get<Warehouse[]>("/database/warehouses")
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
