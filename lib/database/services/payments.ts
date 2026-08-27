import { api } from "@/lib/axios"
import type { Payment } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all payments with no pagination — for dropdowns / pickers. */
export async function fetchPaymentsAll(): Promise<Payment[]> {
  const { data } = await api.get<Payment[]>("/database/payments", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<Payment>).data
}

/** Fetch a paginated + searched page of payments. */
export async function fetchPaymentsPaginated(params: ListParams): Promise<PaginatedResponse<Payment>> {
  const { data } = await api.get<PaginatedResponse<Payment>>("/database/payments", { params })
  return data
}

export async function createPayment(input: Partial<Payment>): Promise<Payment> {
  const { data } = await api.post<Payment>("/database/payments", input)
  return data
}

export async function updatePayment(id: string, input: Partial<Payment>): Promise<Payment> {
  const { data } = await api.put<Payment>("/database/payments", input, { params: { id } })
  return data
}

// No delete: payments are financial records and are never hard-deleted.
