"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchDebitNoteItems,
  createDebitNoteItem,
  updateDebitNoteItem,
  deleteDebitNoteItem,
} from "@/lib/database/services/debit-note-items"
import type { DebitNoteItem } from "@/lib/database/types"

export function useDebitNoteItems(debitNoteId: string | undefined) {
  return useQuery({
    queryKey: ["debit-note-items", debitNoteId],
    queryFn: () => fetchDebitNoteItems(debitNoteId!),
    enabled: !!debitNoteId,
  })
}

export function useCreateDebitNoteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<DebitNoteItem> & { debit_note_id: string }) =>
      createDebitNoteItem(input),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["debit-note-items", variables.debit_note_id] }),
  })
}

export function useUpdateDebitNoteItem(debitNoteId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<DebitNoteItem> }) =>
      updateDebitNoteItem(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["debit-note-items", debitNoteId] }),
  })
}

export function useDeleteDebitNoteItem(debitNoteId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDebitNoteItem(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["debit-note-items", debitNoteId] }),
  })
}
