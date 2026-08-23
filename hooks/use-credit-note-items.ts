"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchCreditNoteItems,
  createCreditNoteItem,
  updateCreditNoteItem,
  deleteCreditNoteItem,
} from "@/lib/database/services/credit-note-items"
import type { CreditNoteItem } from "@/lib/database/types"

export function useCreditNoteItems(creditNoteId: string | undefined) {
  return useQuery({
    queryKey: ["credit-note-items", creditNoteId],
    queryFn: () => fetchCreditNoteItems(creditNoteId!),
    enabled: !!creditNoteId,
  })
}

export function useCreateCreditNoteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<CreditNoteItem> & { credit_note_id: string }) =>
      createCreditNoteItem(input),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({
        queryKey: ["credit-note-items", variables.credit_note_id],
      }),
  })
}

export function useUpdateCreditNoteItem(creditNoteId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreditNoteItem> }) =>
      updateCreditNoteItem(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["credit-note-items", creditNoteId] }),
  })
}

export function useDeleteCreditNoteItem(creditNoteId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCreditNoteItem(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["credit-note-items", creditNoteId] }),
  })
}
