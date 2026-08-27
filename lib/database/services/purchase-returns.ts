import { api } from "@/lib/axios"
import type { PurchaseReturn } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all purchase returns with no pagination — for dropdowns / pickers. */
export async function fetchPurchaseReturnsAll(): Promise<PurchaseReturn[]> {
  const { data } = await api.get<PurchaseReturn[]>("/database/purchase_returns", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<PurchaseReturn>).data
}

/** Fetch a single record by id — for detail pages, instead of pulling
 * every row via fetchPurchaseReturnsAll() and finding it client-side. */
export async function fetchPurchaseReturnById(id: string): Promise<PurchaseReturn> {
  const { data } = await api.get<PurchaseReturn>("/database/purchase_returns", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of purchase returns. */
export async function fetchPurchaseReturnsPaginated(params: ListParams): Promise<PaginatedResponse<PurchaseReturn>> {
  const { data } = await api.get<PaginatedResponse<PurchaseReturn>>("/database/purchase_returns", { params })
  return data
}

export async function createPurchaseReturn(input: Partial<PurchaseReturn>): Promise<PurchaseReturn> {
  const { data } = await api.post<PurchaseReturn>("/database/purchase_returns", input)
  return data
}

export async function updatePurchaseReturn(id: string, input: Partial<PurchaseReturn>): Promise<PurchaseReturn> {
  const { data } = await api.put<PurchaseReturn>("/database/purchase_returns", input, { params: { id } })
  return data
}

// No delete: purchase returns are financial records — cancel via
// updatePurchaseReturn(id, { status: "void" }), never hard-deleted.
