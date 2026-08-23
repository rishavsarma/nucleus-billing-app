import { api } from "@/lib/axios"
import type { StockMovement } from "@/lib/database/types"

export async function fetchStockMovements(): Promise<StockMovement[]> {
  const { data } = await api.get<StockMovement[]>("/billing/stock_movements")
  return data
}

export async function createStockMovement(
  input: Partial<StockMovement>,
): Promise<StockMovement> {
  const { data } = await api.post<StockMovement>("/billing/stock_movements", input)
  return data
}

// No update/delete: stock_movements is an append-only ledger — corrections
// are offsetting rows (another createStockMovement call), never edits. See
// billing.stock_movements_immutable() in functions-trigger.sql.
