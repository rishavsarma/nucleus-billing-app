import { api } from "@/lib/axios"
import type { TaxRate } from "@/lib/database/types"

export async function fetchTaxRates(): Promise<TaxRate[]> {
  const { data } = await api.get<TaxRate[]>("/database/tax_rates")
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
