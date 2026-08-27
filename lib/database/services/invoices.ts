import { api } from "@/lib/axios"
import type { Invoice, InvoiceWithCustomer } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch a single record by id — for detail pages. */
export async function fetchInvoiceById(id: string): Promise<Invoice> {
  const { data } = await api.get<Invoice>("/database/invoices", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of invoices, with each row's customer
 * name embedded (a real server-side join over customer_id) — no separate
 * fetch-every-customer call needed to resolve it for display. Optionally
 * scoped to one customer (e.g. the "which invoice is this against" picker
 * on the new credit note / sales return forms), instead of fetching every
 * invoice in the org and filtering client-side. */
export async function fetchInvoicesPaginated(
  params: ListParams & { customer_id?: string },
): Promise<PaginatedResponse<InvoiceWithCustomer>> {
  const { data } = await api.get<PaginatedResponse<InvoiceWithCustomer>>("/database/invoices", { params })
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
