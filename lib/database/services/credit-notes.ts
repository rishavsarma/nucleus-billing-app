import { api } from "@/lib/axios"
import type { CreditNote, CreditNoteWithCustomer } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all creditnotes with no pagination — for dropdowns / pickers. */
export async function fetchCreditNotesAll(): Promise<CreditNote[]> {
  const { data } = await api.get<CreditNote[]>("/database/credit_notes", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<CreditNote>).data
}

/** Fetch a single record by id — for detail pages, instead of pulling
 * every row via fetchCreditNotesAll() and finding it client-side. */
export async function fetchCreditNoteById(id: string): Promise<CreditNote> {
  const { data } = await api.get<CreditNote>("/database/credit_notes", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of credit notes, with each row's
 * customer name embedded via a real server-side join. */
export async function fetchCreditNotesPaginated(params: ListParams): Promise<PaginatedResponse<CreditNoteWithCustomer>> {
  const { data } = await api.get<PaginatedResponse<CreditNoteWithCustomer>>("/database/credit_notes", { params })
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
