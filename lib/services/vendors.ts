import { api } from "@/lib/axios"
import type { Vendor } from "@/lib/billing/types"

export async function fetchVendors(): Promise<Vendor[]> {
  const { data } = await api.get<Vendor[]>("/billing/vendors")
  return data
}

export async function createVendor(input: Partial<Vendor>): Promise<Vendor> {
  const { data } = await api.post<Vendor>("/billing/vendors", input)
  return data
}

export async function updateVendor(id: string, input: Partial<Vendor>): Promise<Vendor> {
  const { data } = await api.put<Vendor>("/billing/vendors", input, { params: { id } })
  return data
}

export async function deleteVendor(id: string): Promise<void> {
  await api.delete("/billing/vendors", { params: { id } })
}
