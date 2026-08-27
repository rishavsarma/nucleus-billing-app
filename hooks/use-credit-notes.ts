"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchCreditNotesAll, fetchCreditNoteById, fetchCreditNotesPaginated, createCreditNote, updateCreditNote } from "@/lib/database/services/credit-notes"
import type { CreditNote } from "@/lib/database/types"

/** All records — use in dropdowns/pickers where you need every option. */
export function useCreditNotes() {
  return useQuery({
    queryKey: ["credit-notes", "all"],
    queryFn: fetchCreditNotesAll,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function useCreditNotesList(params: ListParams) {
  return useQuery({
    queryKey: ["credit-notes", "list", params],
    queryFn: () => fetchCreditNotesPaginated(params),
  })
}

/** Single record by id — for detail pages. */
export function useCreditNote(id: string) {
  return useQuery({
    queryKey: ["credit-notes", "detail", id],
    queryFn: () => fetchCreditNoteById(id),
    enabled: !!id,
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
