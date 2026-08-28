"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchItemById, fetchItemsPaginated, createItem, updateItem, deleteItem } from "@/lib/database/services/items"
import type { Item } from "@/lib/database/types"

/** Paginated + searched list — use in list-view table pages. */
export function useItemsList(params: ListParams) {
  return useQuery({
    queryKey: ["items", "list", params],
    queryFn: () => fetchItemsPaginated(params),
    placeholderData: keepPreviousData,
  })
}

/** Single record by id — for detail pages. */
export function useItem(id: string | undefined) {
  return useQuery({
    queryKey: ["items", "detail", id],
    queryFn: () => fetchItemById(id!),
    enabled: !!id,
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
