import { api } from "@/lib/axios"
import type { CreditNoteItem } from "@/lib/database/types"

export async function fetchCreditNoteItems(creditNoteId: string): Promise<CreditNoteItem[]> {
  const { data } = await api.get<CreditNoteItem[]>("/database/credit_note_items", {
    params: { credit_note_id: creditNoteId },
  })
  return data
}

export async function createCreditNoteItem(
  input: Partial<CreditNoteItem> & { credit_note_id: string },
): Promise<CreditNoteItem> {
  const { data } = await api.post<CreditNoteItem>("/database/credit_note_items", input)
  return data
}

export async function updateCreditNoteItem(
  id: string,
  input: Partial<CreditNoteItem>,
): Promise<CreditNoteItem> {
  const { data } = await api.put<CreditNoteItem>("/database/credit_note_items", input, {
    params: { id },
  })
  return data
}

export async function deleteCreditNoteItem(id: string): Promise<void> {
  await api.delete("/database/credit_note_items", { params: { id } })
}
