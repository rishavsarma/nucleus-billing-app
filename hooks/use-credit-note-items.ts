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

// Also invalidates ["credit-notes"]: recalc_credit_note() (see
// 002_functions_triggers.sql) recomputes the parent credit note's
// subtotal/tax_total/total whenever its line items change.

export function useCreateCreditNoteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<CreditNoteItem> & { credit_note_id: string }) =>
      createCreditNoteItem(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["credit-note-items", variables.credit_note_id] })
      queryClient.invalidateQueries({ queryKey: ["credit-notes"] })
    },
  })
}

export function useUpdateCreditNoteItem(creditNoteId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreditNoteItem> }) =>
      updateCreditNoteItem(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-note-items", creditNoteId] })
      queryClient.invalidateQueries({ queryKey: ["credit-notes"] })
    },
  })
}

export function useDeleteCreditNoteItem(creditNoteId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCreditNoteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-note-items", creditNoteId] })
      queryClient.invalidateQueries({ queryKey: ["credit-notes"] })
    },
  })
}
