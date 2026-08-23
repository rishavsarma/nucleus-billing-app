"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchDebitNotes, createDebitNote, updateDebitNote } from "@/lib/database/services/debit-notes"
import type { DebitNote } from "@/lib/database/types"

export function useDebitNotes() {
  return useQuery({
    queryKey: ["debit-notes"],
    queryFn: fetchDebitNotes,
  })
}

export function useCreateDebitNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<DebitNote>) => createDebitNote(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["debit-notes"] }),
  })
}

export function useUpdateDebitNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<DebitNote> }) =>
      updateDebitNote(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["debit-notes"] }),
  })
}

// No delete mutation: debit notes are financial records — cancel via
// useUpdateDebitNote({ status: "void" }), never hard-deleted.
