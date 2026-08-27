import { api } from "@/lib/axios"
import type { PurchaseBill } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all purchasebills with no pagination — for dropdowns / pickers. */
export async function fetchPurchaseBillsAll(): Promise<PurchaseBill[]> {
  const { data } = await api.get<PurchaseBill[]>("/database/purchase_bills", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<PurchaseBill>).data
}

/** Fetch a single record by id — for detail pages, instead of pulling
 * every row via fetchPurchaseBillsAll() and finding it client-side. */
export async function fetchPurchaseBillById(id: string): Promise<PurchaseBill> {
  const { data } = await api.get<PurchaseBill>("/database/purchase_bills", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of purchasebills. */
export async function fetchPurchaseBillsPaginated(params: ListParams): Promise<PaginatedResponse<PurchaseBill>> {
  const { data } = await api.get<PaginatedResponse<PurchaseBill>>("/database/purchase_bills", { params })
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
