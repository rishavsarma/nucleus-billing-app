import { api } from "@/lib/axios"
import type { SalesReturnItem } from "@/lib/database/types"

export async function fetchSalesReturnItems(salesReturnId: string): Promise<SalesReturnItem[]> {
  const { data } = await api.get<SalesReturnItem[]>("/database/sales_return_items", {
    params: { sales_return_id: salesReturnId },
  })
  return data
}

export async function createSalesReturnItem(
  input: Partial<SalesReturnItem> & { sales_return_id: string },
): Promise<SalesReturnItem> {
  const { data } = await api.post<SalesReturnItem>("/database/sales_return_items", input)
  return data
}

export async function updateSalesReturnItem(
  id: string,
  input: Partial<SalesReturnItem>,
): Promise<SalesReturnItem> {
  const { data } = await api.put<SalesReturnItem>("/database/sales_return_items", input, {
    params: { id },
  })
  return data
}

export async function deleteSalesReturnItem(id: string): Promise<void> {
  await api.delete("/database/sales_return_items", { params: { id } })
}
