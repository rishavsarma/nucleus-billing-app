import { api } from "@/lib/axios"
import type { Vendor } from "@/lib/database/types"

export async function fetchVendors(): Promise<Vendor[]> {
  const { data } = await api.get<Vendor[]>("/database/vendors")
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
