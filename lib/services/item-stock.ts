import { api } from "@/lib/axios"
import type { ItemStock } from "@/lib/billing/types"

export async function fetchItemStock(itemId: string): Promise<ItemStock[]> {
  const { data } = await api.get<ItemStock[]>("/billing/item_stock", {
    params: { item_id: itemId },
  })
  return data
}

// No create/update/delete: item_stock is read-only from the API (see
// rls-policies.sql, which grants only item_stock_select). All writes happen
// via the billing.stock_movements_apply() trigger, driven by
// createStockMovement().
