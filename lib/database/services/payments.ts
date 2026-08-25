import { api } from "@/lib/axios"
import type { Payment } from "@/lib/database/types"

export async function fetchPayments(): Promise<Payment[]> {
  const { data } = await api.get<Payment[]>("/database/payments")
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
