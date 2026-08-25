import { api } from "@/lib/axios"
import type { Customer } from "@/lib/database/types"

export async function fetchCustomers(): Promise<Customer[]> {
  const { data } = await api.get<Customer[]>("/database/customers")
  return data
}

export async function createCustomer(input: Partial<Customer>): Promise<Customer> {
  const { data } = await api.post<Customer>("/database/customers", input)
  return data
}

export async function updateCustomer(id: string, input: Partial<Customer>): Promise<Customer> {
  const { data } = await api.put<Customer>("/database/customers", input, { params: { id } })
  return data
}

export async function deleteCustomer(id: string): Promise<void> {
  await api.delete("/database/customers", { params: { id } })
}
