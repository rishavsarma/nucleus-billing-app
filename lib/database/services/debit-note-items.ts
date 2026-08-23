import { api } from "@/lib/axios"
import type { DebitNoteItem } from "@/lib/database/types"

export async function fetchDebitNoteItems(debitNoteId: string): Promise<DebitNoteItem[]> {
  const { data } = await api.get<DebitNoteItem[]>("/billing/debit_note_items", {
    params: { debit_note_id: debitNoteId },
  })
  return data
}

export async function createDebitNoteItem(
  input: Partial<DebitNoteItem> & { debit_note_id: string },
): Promise<DebitNoteItem> {
  const { data } = await api.post<DebitNoteItem>("/billing/debit_note_items", input)
  return data
}

export async function updateDebitNoteItem(
  id: string,
  input: Partial<DebitNoteItem>,
): Promise<DebitNoteItem> {
  const { data } = await api.put<DebitNoteItem>("/billing/debit_note_items", input, {
    params: { id },
  })
  return data
}

export async function deleteDebitNoteItem(id: string): Promise<void> {
  await api.delete("/billing/debit_note_items", { params: { id } })
}
