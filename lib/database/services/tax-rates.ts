import { api } from "@/lib/axios"
import type { TaxRate } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all tax rates — for dropdowns/pickers. Capped at 50 rather than
 * unbounded (9999): tax rates are tied to a jurisdiction's real tax
 * categories, not to transaction volume or headcount, so 50 is a
 * comfortable ceiling rather than a claim of zero risk. */
export async function fetchTaxRatesAll(): Promise<TaxRate[]> {
  const { data } = await api.get<TaxRate[]>("/database/tax_rates", { params: { page: 1, pageSize: 50 } })
  return (data as unknown as PaginatedResponse<TaxRate>).data
}

/** Fetch a paginated + searched page of taxrates. */
export async function fetchTaxRatesPaginated(params: ListParams): Promise<PaginatedResponse<TaxRate>> {
  const { data } = await api.get<PaginatedResponse<TaxRate>>("/database/tax_rates", { params })
  return data
}

export async function createTaxRate(input: Partial<TaxRate>): Promise<TaxRate> {
  const { data } = await api.post<TaxRate>("/database/tax_rates", input)
  return data
}

export async function updateTaxRate(id: string, input: Partial<TaxRate>): Promise<TaxRate> {
  const { data } = await api.put<TaxRate>("/database/tax_rates", input, { params: { id } })
  return data
}

export async function deleteTaxRate(id: string): Promise<void> {
  await api.delete("/database/tax_rates", { params: { id } })
}
