import { api } from "@/lib/axios"
import type { Item } from "@/lib/billing/types"

export async function fetchItems(): Promise<Item[]> {
  const { data } = await api.get<Item[]>("/billing/items")
  return data
}

export async function createItem(input: Partial<Item>): Promise<Item> {
  const { data } = await api.post<Item>("/billing/items", input)
  return data
}

export async function updateItem(id: string, input: Partial<Item>): Promise<Item> {
  const { data } = await api.put<Item>("/billing/items", input, { params: { id } })
  return data
}

export async function deleteItem(id: string): Promise<void> {
  await api.delete("/billing/items", { params: { id } })
}
