"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchCreditNotes, createCreditNote, updateCreditNote } from "@/lib/database/services/credit-notes"
import type { CreditNote } from "@/lib/database/types"

export function useCreditNotes() {
  return useQuery({
    queryKey: ["credit-notes"],
    queryFn: fetchCreditNotes,
  })
}

export function useCreateCreditNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<CreditNote>) => createCreditNote(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["credit-notes"] }),
  })
}

export function useUpdateCreditNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreditNote> }) =>
      updateCreditNote(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["credit-notes"] }),
  })
}

// No delete mutation: credit notes are financial records — cancel via
// useUpdateCreditNote({ status: "void" }), never hard-deleted.
