"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchItems, createItem, updateItem, deleteItem } from "@/lib/services/items"
import type { Item } from "@/lib/billing/types"

export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: fetchItems,
  })
}

export function useCreateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Item>) => createItem(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  })
}

export function useUpdateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Item> }) => updateItem(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  })
}
