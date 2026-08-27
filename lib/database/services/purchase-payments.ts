import { api } from "@/lib/axios"
import type { PurchasePayment, PurchasePaymentWithRelations } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all purchasepayments with no pagination — for dropdowns / pickers. */
export async function fetchPurchasePaymentsAll(): Promise<PurchasePayment[]> {
  const { data } = await api.get<PurchasePayment[]>("/database/purchase_payments", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<PurchasePayment>).data
}

/** Fetch a paginated + searched page of purchase payments, with each row's
 * bill number and (nested) vendor name embedded via real joins. */
export async function fetchPurchasePaymentsPaginated(params: ListParams): Promise<PaginatedResponse<PurchasePaymentWithRelations>> {
  const { data } = await api.get<PaginatedResponse<PurchasePaymentWithRelations>>("/database/purchase_payments", { params })
  return data
}

export async function createPurchasePayment(
  input: Partial<PurchasePayment>,
): Promise<PurchasePayment> {
  const { data } = await api.post<PurchasePayment>("/database/purchase_payments", input)
  return data
}

export async function updatePurchasePayment(
  id: string,
  input: Partial<PurchasePayment>,
): Promise<PurchasePayment> {
  const { data } = await api.put<PurchasePayment>("/database/purchase_payments", input, {
    params: { id },
  })
  return data
}

// No delete: purchase payments are financial records and are never
// hard-deleted.
