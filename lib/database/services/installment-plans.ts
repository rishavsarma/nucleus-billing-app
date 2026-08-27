import { api } from "@/lib/axios"
import type { InstallmentPlan } from "@/lib/database/types"

/** The one installment plan tied to an invoice, or null if none exists. */
export async function fetchInstallmentPlanByInvoiceId(invoiceId: string): Promise<InstallmentPlan | null> {
  const { data } = await api.get<InstallmentPlan | null>("/database/installment_plans", {
    params: { invoice_id: invoiceId },
  })
  return data
}

export async function createInstallmentPlan(
  input: Partial<InstallmentPlan> & { invoice_id: string },
): Promise<InstallmentPlan> {
  const { data } = await api.post<InstallmentPlan>("/database/installment_plans", input)
  return data
}

export async function updateInstallmentPlan(id: string, input: Partial<InstallmentPlan>): Promise<InstallmentPlan> {
  const { data } = await api.put<InstallmentPlan>("/database/installment_plans", input, { params: { id } })
  return data
}

// No delete: cancellation is a status update (status = "cancelled").
