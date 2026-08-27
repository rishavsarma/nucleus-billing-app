"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchDebitNotesAll, fetchDebitNoteById, fetchDebitNotesPaginated, createDebitNote, updateDebitNote } from "@/lib/database/services/debit-notes"
import type { DebitNote } from "@/lib/database/types"

/** All records — use in dropdowns/pickers where you need every option. */
export function useDebitNotes() {
  return useQuery({
    queryKey: ["debit-notes", "all"],
    queryFn: fetchDebitNotesAll,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function useDebitNotesList(params: ListParams) {
  return useQuery({
    queryKey: ["debit-notes", "list", params],
    queryFn: () => fetchDebitNotesPaginated(params),
  })
}

/** Single record by id — for detail pages. */
export function useDebitNote(id: string) {
  return useQuery({
    queryKey: ["debit-notes", "detail", id],
    queryFn: () => fetchDebitNoteById(id),
    enabled: !!id,
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
