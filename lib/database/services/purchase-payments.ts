import { api } from "@/lib/axios"
import type { PurchasePayment } from "@/lib/database/types"

export async function fetchPurchasePayments(): Promise<PurchasePayment[]> {
  const { data } = await api.get<PurchasePayment[]>("/billing/purchase_payments")
  return data
}

export async function createPurchasePayment(
  input: Partial<PurchasePayment>,
): Promise<PurchasePayment> {
  const { data } = await api.post<PurchasePayment>("/billing/purchase_payments", input)
  return data
}

export async function updatePurchasePayment(
  id: string,
  input: Partial<PurchasePayment>,
): Promise<PurchasePayment> {
  const { data } = await api.put<PurchasePayment>("/billing/purchase_payments", input, {
    params: { id },
  })
  return data
}

// No delete: purchase payments are financial records and are never
// hard-deleted.
