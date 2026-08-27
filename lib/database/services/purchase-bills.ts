import { api } from "@/lib/axios"
import type { PurchaseBill, PurchaseBillWithVendor } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch a single record by id — for detail pages. */
export async function fetchPurchaseBillById(id: string): Promise<PurchaseBill> {
  const { data } = await api.get<PurchaseBill>("/database/purchase_bills", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of purchase bills, with each row's
 * vendor name embedded via a real server-side join. Optionally scoped to
 * one vendor (e.g. the "which bill is this debit note against" picker on
 * the new debit note / purchase return forms). */
export async function fetchPurchaseBillsPaginated(
  params: ListParams & { vendor_id?: string },
): Promise<PaginatedResponse<PurchaseBillWithVendor>> {
  const { data } = await api.get<PaginatedResponse<PurchaseBillWithVendor>>("/database/purchase_bills", { params })
  return data
}

export async function createPurchaseBill(input: Partial<PurchaseBill>): Promise<PurchaseBill> {
  const { data } = await api.post<PurchaseBill>("/database/purchase_bills", input)
  return data
}

export async function updatePurchaseBill(
  id: string,
  input: Partial<PurchaseBill>,
): Promise<PurchaseBill> {
  const { data } = await api.put<PurchaseBill>("/database/purchase_bills", input, {
    params: { id },
  })
  return data
}

// No delete: purchase bills are financial records — cancel via
// updatePurchaseBill(id, { status: "void" }), never hard-deleted.
