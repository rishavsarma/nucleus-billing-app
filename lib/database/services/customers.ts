import { api } from "@/lib/axios"
import type { Customer } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch a single record by id — for detail pages. */
export async function fetchCustomerById(id: string): Promise<Customer> {
  const { data } = await api.get<Customer>("/database/customers", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of customers. */
export async function fetchCustomersPaginated(params: ListParams): Promise<PaginatedResponse<Customer>> {
  const { data } = await api.get<PaginatedResponse<Customer>>("/database/customers", { params })
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
