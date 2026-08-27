import { api } from "@/lib/axios"
import type { Invoice } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all invoices with no pagination — for dropdowns / pickers. */
export async function fetchInvoicesAll(): Promise<Invoice[]> {
  const { data } = await api.get<Invoice[]>("/database/invoices", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<Invoice>).data
}

/** Fetch a single record by id — for detail pages, instead of pulling
 * every row via fetchInvoicesAll() and finding it client-side. */
export async function fetchInvoiceById(id: string): Promise<Invoice> {
  const { data } = await api.get<Invoice>("/database/invoices", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of invoices. */
export async function fetchInvoicesPaginated(params: ListParams): Promise<PaginatedResponse<Invoice>> {
  const { data } = await api.get<PaginatedResponse<Invoice>>("/database/invoices", { params })
  return data
}

export async function createInvoice(input: Partial<Invoice>): Promise<Invoice> {
  const { data } = await api.post<Invoice>("/database/invoices", input)
  return data
}

export async function updateInvoice(id: string, input: Partial<Invoice>): Promise<Invoice> {
  const { data } = await api.put<Invoice>("/database/invoices", input, { params: { id } })
  return data
}

// No delete: invoices are financial records — cancel via
// updateInvoice(id, { status: "void" }), never hard-deleted.
