import { api } from "@/lib/axios"
import type { TaxRate } from "@/lib/billing/types"

export async function fetchTaxRates(): Promise<TaxRate[]> {
  const { data } = await api.get<TaxRate[]>("/billing/tax_rates")
  return data
}

export async function createTaxRate(input: Partial<TaxRate>): Promise<TaxRate> {
  const { data } = await api.post<TaxRate>("/billing/tax_rates", input)
  return data
}

export async function updateTaxRate(id: string, input: Partial<TaxRate>): Promise<TaxRate> {
  const { data } = await api.put<TaxRate>("/billing/tax_rates", input, { params: { id } })
  return data
}

export async function deleteTaxRate(id: string): Promise<void> {
  await api.delete("/billing/tax_rates", { params: { id } })
}
