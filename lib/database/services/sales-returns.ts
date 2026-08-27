import { api } from "@/lib/axios"
import type { SalesReturn, SalesReturnWithRelations } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all sales returns with no pagination — for dropdowns / pickers. */
export async function fetchSalesReturnsAll(): Promise<SalesReturn[]> {
  const { data } = await api.get<SalesReturn[]>("/database/sales_returns", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<SalesReturn>).data
}

/** Fetch a single record by id — for detail pages, instead of pulling
 * every row via fetchSalesReturnsAll() and finding it client-side. */
export async function fetchSalesReturnById(id: string): Promise<SalesReturn> {
  const { data } = await api.get<SalesReturn>("/database/sales_returns", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of sales returns, with each row's
 * customer name and original invoice number embedded via real joins. */
export async function fetchSalesReturnsPaginated(params: ListParams): Promise<PaginatedResponse<SalesReturnWithRelations>> {
  const { data } = await api.get<PaginatedResponse<SalesReturnWithRelations>>("/database/sales_returns", { params })
  return data
}

export async function createSalesReturn(input: Partial<SalesReturn>): Promise<SalesReturn> {
  const { data } = await api.post<SalesReturn>("/database/sales_returns", input)
  return data
}

export async function updateSalesReturn(id: string, input: Partial<SalesReturn>): Promise<SalesReturn> {
  const { data } = await api.put<SalesReturn>("/database/sales_returns", input, { params: { id } })
  return data
}

// No delete: sales returns are financial records — cancel via
// updateSalesReturn(id, { status: "void" }), never hard-deleted.
