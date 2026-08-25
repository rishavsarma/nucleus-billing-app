import { api } from "@/lib/axios"
import type { Item } from "@/lib/database/types"

export async function fetchItems(): Promise<Item[]> {
  const { data } = await api.get<Item[]>("/database/items")
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
