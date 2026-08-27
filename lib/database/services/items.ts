import { api } from "@/lib/axios"
import type { Item, ItemWithTaxRate } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all items with no pagination — for dropdowns / pickers. */
export async function fetchItemsAll(): Promise<Item[]> {
  const { data } = await api.get<Item[]>("/database/items", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<Item>).data
}

/** Fetch a single record by id — for detail pages, instead of pulling
 * every row via fetchItemsAll() and finding it client-side. */
export async function fetchItemById(id: string): Promise<Item> {
  const { data } = await api.get<Item>("/database/items", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of items, with each row's tax rate
 * name embedded via a real server-side join. */
export async function fetchItemsPaginated(params: ListParams): Promise<PaginatedResponse<ItemWithTaxRate>> {
  const { data } = await api.get<PaginatedResponse<ItemWithTaxRate>>("/database/items", { params })
  return data
}

export async function createItem(input: Partial<Item>): Promise<Item> {
  const { data } = await api.post<Item>("/database/items", input)
  return data
}

export async function updateItem(id: string, input: Partial<Item>): Promise<Item> {
  const { data } = await api.put<Item>("/database/items", input, { params: { id } })
  return data
}

export async function deleteItem(id: string): Promise<void> {
  await api.delete("/database/items", { params: { id } })
}
