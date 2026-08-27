import { api } from "@/lib/axios"
import type { StockMovement, StockMovementWithRelations } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all stockmovements with no pagination — for dropdowns / pickers. */
export async function fetchStockMovementsAll(): Promise<StockMovement[]> {
  const { data } = await api.get<StockMovement[]>("/database/stock_movements", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<StockMovement>).data
}

/** Fetch a paginated + searched page of stock movements, with each row's
 * item name and warehouse name embedded via real server-side joins. */
export async function fetchStockMovementsPaginated(params: ListParams): Promise<PaginatedResponse<StockMovementWithRelations>> {
  const { data } = await api.get<PaginatedResponse<StockMovementWithRelations>>("/database/stock_movements", { params })
  return data
}

export async function createStockMovement(
  input: Partial<StockMovement>,
): Promise<StockMovement> {
  const { data } = await api.post<StockMovement>("/database/stock_movements", input)
  return data
}

// No update/delete: stock_movements is an append-only ledger — corrections
// are offsetting rows (another createStockMovement call), never edits. See
// billing.stock_movements_immutable() in functions-trigger.sql.
