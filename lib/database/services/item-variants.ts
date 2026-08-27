import { api } from "@/lib/axios"
import type { ItemVariant } from "@/lib/database/types"

export async function fetchItemVariants(itemId: string, warehouseId?: string): Promise<ItemVariant[]> {
  const { data } = await api.get<ItemVariant[]>("/database/item_variants", {
    params: { item_id: itemId, ...(warehouseId ? { warehouse_id: warehouseId } : {}) },
  })
  return data
}

/** Every requested item's variants in one request — for screens that render
 * many items at once (the Items list price column, the POS item grid),
 * instead of firing one item_variants request per item/tile. */
export async function fetchItemVariantsBulk(itemIds: string[], warehouseId?: string): Promise<ItemVariant[]> {
  if (!itemIds.length) return []
  const { data } = await api.get<ItemVariant[]>("/database/item_variants", {
    params: { item_ids: itemIds.join(","), ...(warehouseId ? { warehouse_id: warehouseId } : {}) },
  })
  return data
}

// No create/update/delete: item_variants is read-only from the API. All
// writes happen via the *_stock_effect() DB trigger functions, driven by a
// purchase bill/invoice/credit note/debit note's status actually changing.
