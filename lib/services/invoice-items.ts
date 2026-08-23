import { api } from "@/lib/axios"
import type { InvoiceItem } from "@/lib/billing/types"

export async function fetchInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const { data } = await api.get<InvoiceItem[]>("/billing/invoice_items", {
    params: { invoice_id: invoiceId },
  })
  return data
}

export async function createInvoiceItem(
  input: Partial<InvoiceItem> & { invoice_id: string },
): Promise<InvoiceItem> {
  const { data } = await api.post<InvoiceItem>("/billing/invoice_items", input)
  return data
}

export async function updateInvoiceItem(
  id: string,
  input: Partial<InvoiceItem>,
): Promise<InvoiceItem> {
  const { data } = await api.put<InvoiceItem>("/billing/invoice_items", input, {
    params: { id },
  })
  return data
}

export async function deleteInvoiceItem(id: string): Promise<void> {
  await api.delete("/billing/invoice_items", { params: { id } })
}
