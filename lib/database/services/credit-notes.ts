import { api } from "@/lib/axios"
import type { CreditNote } from "@/lib/database/types"

export async function fetchCreditNotes(): Promise<CreditNote[]> {
  const { data } = await api.get<CreditNote[]>("/database/credit_notes")
  return data
}

export async function createCreditNote(input: Partial<CreditNote>): Promise<CreditNote> {
  const { data } = await api.post<CreditNote>("/database/credit_notes", input)
  return data
}

export async function updateCreditNote(
  id: string,
  input: Partial<CreditNote>,
): Promise<CreditNote> {
  const { data } = await api.put<CreditNote>("/database/credit_notes", input, { params: { id } })
  return data
}

// No delete: credit notes are financial records — cancel via
// updateCreditNote(id, { status: "void" }), never hard-deleted.
