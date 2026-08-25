import { api } from "@/lib/axios"
import type { PurchaseBillItem } from "@/lib/database/types"

export async function fetchPurchaseBillItems(purchaseBillId: string): Promise<PurchaseBillItem[]> {
  const { data } = await api.get<PurchaseBillItem[]>("/database/purchase_bill_items", {
    params: { purchase_bill_id: purchaseBillId },
  })
  return data
}

export async function createPurchaseBillItem(
  input: Partial<PurchaseBillItem> & { purchase_bill_id: string },
): Promise<PurchaseBillItem> {
  const { data } = await api.post<PurchaseBillItem>("/database/purchase_bill_items", input)
  return data
}

export async function updatePurchaseBillItem(
  id: string,
  input: Partial<PurchaseBillItem>,
): Promise<PurchaseBillItem> {
  const { data } = await api.put<PurchaseBillItem>("/database/purchase_bill_items", input, {
    params: { id },
  })
  return data
}

export async function deletePurchaseBillItem(id: string): Promise<void> {
  await api.delete("/database/purchase_bill_items", { params: { id } })
}
