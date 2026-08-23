import { api } from "@/lib/axios"
import type { DebitNote } from "@/lib/billing/types"

export async function fetchDebitNotes(): Promise<DebitNote[]> {
  const { data } = await api.get<DebitNote[]>("/billing/debit_notes")
  return data
}

export async function createDebitNote(input: Partial<DebitNote>): Promise<DebitNote> {
  const { data } = await api.post<DebitNote>("/billing/debit_notes", input)
  return data
}

export async function updateDebitNote(
  id: string,
  input: Partial<DebitNote>,
): Promise<DebitNote> {
  const { data } = await api.put<DebitNote>("/billing/debit_notes", input, { params: { id } })
  return data
}

// No delete: debit notes are financial records — cancel via
// updateDebitNote(id, { status: "void" }), never hard-deleted.
