import { api } from "@/lib/axios"
import type { DebitNote } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all debitnotes with no pagination — for dropdowns / pickers. */
export async function fetchDebitNotesAll(): Promise<DebitNote[]> {
  const { data } = await api.get<DebitNote[]>("/database/debit_notes", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<DebitNote>).data
}

/** Fetch a single record by id — for detail pages, instead of pulling
 * every row via fetchDebitNotesAll() and finding it client-side. */
export async function fetchDebitNoteById(id: string): Promise<DebitNote> {
  const { data } = await api.get<DebitNote>("/database/debit_notes", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of debitnotes. */
export async function fetchDebitNotesPaginated(params: ListParams): Promise<PaginatedResponse<DebitNote>> {
  const { data } = await api.get<PaginatedResponse<DebitNote>>("/database/debit_notes", { params })
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
