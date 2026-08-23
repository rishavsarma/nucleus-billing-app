import { api } from "@/lib/axios"
import type { PurchaseBill } from "@/lib/database/types"

export async function fetchPurchaseBills(): Promise<PurchaseBill[]> {
  const { data } = await api.get<PurchaseBill[]>("/billing/purchase_bills")
  return data
}

export async function createPurchaseBill(input: Partial<PurchaseBill>): Promise<PurchaseBill> {
  const { data } = await api.post<PurchaseBill>("/billing/purchase_bills", input)
  return data
}

export async function updatePurchaseBill(
  id: string,
  input: Partial<PurchaseBill>,
): Promise<PurchaseBill> {
  const { data } = await api.put<PurchaseBill>("/billing/purchase_bills", input, {
    params: { id },
  })
  return data
}

// No delete: purchase bills are financial records — cancel via
// updatePurchaseBill(id, { status: "void" }), never hard-deleted.
