import { api } from "@/lib/axios"
import type { DeliveryPerson } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all delivery persons with no pagination — for dropdowns / pickers. */
export async function fetchDeliveryPersonsAll(): Promise<DeliveryPerson[]> {
  const { data } = await api.get<DeliveryPerson[]>("/database/delivery_persons", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<DeliveryPerson>).data
}

/** Fetch a paginated + searched page of delivery persons. */
export async function fetchDeliveryPersonsPaginated(params: ListParams): Promise<PaginatedResponse<DeliveryPerson>> {
  const { data } = await api.get<PaginatedResponse<DeliveryPerson>>("/database/delivery_persons", { params })
  return data
}

export async function createDeliveryPerson(input: Partial<DeliveryPerson>): Promise<DeliveryPerson> {
  const { data } = await api.post<DeliveryPerson>("/database/delivery_persons", input)
  return data
}

export async function updateDeliveryPerson(id: string, input: Partial<DeliveryPerson>): Promise<DeliveryPerson> {
  const { data } = await api.put<DeliveryPerson>("/database/delivery_persons", input, { params: { id } })
  return data
}

export async function deleteDeliveryPerson(id: string): Promise<void> {
  await api.delete("/database/delivery_persons", { params: { id } })
}
