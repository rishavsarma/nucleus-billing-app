import { api } from "@/lib/axios"
import type { Invoice } from "@/lib/database/types"

export async function fetchInvoices(): Promise<Invoice[]> {
  const { data } = await api.get<Invoice[]>("/billing/invoices")
  return data
}

export async function createInvoice(input: Partial<Invoice>): Promise<Invoice> {
  const { data } = await api.post<Invoice>("/billing/invoices", input)
  return data
}

export async function updateInvoice(id: string, input: Partial<Invoice>): Promise<Invoice> {
  const { data } = await api.put<Invoice>("/billing/invoices", input, { params: { id } })
  return data
}

// No delete: invoices are financial records — cancel via
// updateInvoice(id, { status: "void" }), never hard-deleted.
