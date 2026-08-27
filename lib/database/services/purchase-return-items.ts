import { api } from "@/lib/axios"
import type { PurchaseReturnItem } from "@/lib/database/types"

export async function fetchPurchaseReturnItems(purchaseReturnId: string): Promise<PurchaseReturnItem[]> {
  const { data } = await api.get<PurchaseReturnItem[]>("/database/purchase_return_items", {
    params: { purchase_return_id: purchaseReturnId },
  })
  return data
}

export async function createPurchaseReturnItem(
  input: Partial<PurchaseReturnItem> & { purchase_return_id: string },
): Promise<PurchaseReturnItem> {
  const { data } = await api.post<PurchaseReturnItem>("/database/purchase_return_items", input)
  return data
}

export async function updatePurchaseReturnItem(
  id: string,
  input: Partial<PurchaseReturnItem>,
): Promise<PurchaseReturnItem> {
  const { data } = await api.put<PurchaseReturnItem>("/database/purchase_return_items", input, {
    params: { id },
  })
  return data
}

export async function deletePurchaseReturnItem(id: string): Promise<void> {
  await api.delete("/database/purchase_return_items", { params: { id } })
}
