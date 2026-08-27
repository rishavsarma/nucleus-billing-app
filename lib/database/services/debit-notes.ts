import { api } from "@/lib/axios"
import type { DebitNote, DebitNoteWithVendor } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch a single record by id — for detail pages. */
export async function fetchDebitNoteById(id: string): Promise<DebitNote> {
  const { data } = await api.get<DebitNote>("/database/debit_notes", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of debit notes, with each row's
 * vendor name embedded via a real server-side join. */
export async function fetchDebitNotesPaginated(params: ListParams): Promise<PaginatedResponse<DebitNoteWithVendor>> {
  const { data } = await api.get<PaginatedResponse<DebitNoteWithVendor>>("/database/debit_notes", { params })
  return data
}

export async function createDebitNote(input: Partial<DebitNote>): Promise<DebitNote> {
  const { data } = await api.post<DebitNote>("/database/debit_notes", input)
  return data
}

export async function updateDebitNote(
  id: string,
  input: Partial<DebitNote>,
): Promise<DebitNote> {
  const { data } = await api.put<DebitNote>("/database/debit_notes", input, { params: { id } })
  return data
}

// No delete: debit notes are financial records — cancel via
// updateDebitNote(id, { status: "void" }), never hard-deleted.
