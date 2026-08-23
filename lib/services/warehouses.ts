import { api } from "@/lib/axios"
import type { Warehouse } from "@/lib/billing/types"

export async function fetchWarehouses(): Promise<Warehouse[]> {
  const { data } = await api.get<Warehouse[]>("/billing/warehouses")
  return data
}

export async function createWarehouse(input: Partial<Warehouse>): Promise<Warehouse> {
  const { data } = await api.post<Warehouse>("/billing/warehouses", input)
  return data
}

export async function updateWarehouse(id: string, input: Partial<Warehouse>): Promise<Warehouse> {
  const { data } = await api.put<Warehouse>("/billing/warehouses", input, { params: { id } })
  return data
}

export async function deleteWarehouse(id: string): Promise<void> {
  await api.delete("/billing/warehouses", { params: { id } })
}
