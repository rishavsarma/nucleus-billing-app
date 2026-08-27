import { api } from "@/lib/axios"
import type { ItemStock, ItemStockRow } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

export async function fetchItemStock(itemId: string): Promise<ItemStock[]> {
  const { data } = await api.get<ItemStock[]>("/database/item_stock", {
    params: { item_id: itemId },
  })
  return data
}

/** Fetch a paginated + searched page of stock, one row per (item, warehouse)
 * with item name/sku/reorder level pre-joined — for the Stock list page. */
export async function fetchItemStockPaginated(params: ListParams): Promise<PaginatedResponse<ItemStockRow>> {
  const { data } = await api.get<PaginatedResponse<ItemStockRow>>("/database/item_stock", { params })
  return data
}

// No create/update/delete: item_stock is read-only from the API (see
// rls-policies.sql, which grants only item_stock_select). All writes happen
// via the billing.stock_movements_apply() trigger, driven by
// createStockMovement().
