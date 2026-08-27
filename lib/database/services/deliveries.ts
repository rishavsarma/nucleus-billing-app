import { api } from "@/lib/axios"
import type { Delivery } from "@/lib/database/types"

/** Fetch the one delivery tied to an invoice, or null if none exists yet. */
export async function fetchDeliveryByInvoiceId(invoiceId: string): Promise<Delivery | null> {
  const { data } = await api.get<Delivery | null>("/database/deliveries", { params: { invoice_id: invoiceId } })
  return data
}

export async function createDelivery(input: Partial<Delivery> & { invoice_id: string }): Promise<Delivery> {
  const { data } = await api.post<Delivery>("/database/deliveries", input)
  return data
}

export async function updateDelivery(id: string, input: Partial<Delivery>): Promise<Delivery> {
  const { data } = await api.put<Delivery>("/database/deliveries", input, { params: { id } })
  return data
}
