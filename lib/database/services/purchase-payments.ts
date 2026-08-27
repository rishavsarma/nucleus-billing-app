import { api } from "@/lib/axios"
import type { PurchasePayment, PurchasePaymentWithRelations } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch just the payments recorded against one purchase bill — for the
 * bill detail page's payment history, scoped server-side rather than
 * fetching every purchase payment in the org (pageSize: 9999) and
 * filtering client-side. */
export async function fetchPurchasePaymentsByBillId(purchaseBillId: string): Promise<PurchasePayment[]> {
  const { data } = await api.get<PurchasePayment[]>("/database/purchase_payments", { params: { purchase_bill_id: purchaseBillId } })
  return data
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
