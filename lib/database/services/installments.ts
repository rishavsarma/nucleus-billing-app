import { api } from "@/lib/axios"
import type { Installment, InstallmentWithInvoice } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Every installment in one plan's schedule — for the invoice detail page. */
export async function fetchInstallmentsByPlanId(planId: string): Promise<Installment[]> {
  const { data } = await api.get<Installment[]>("/database/installments", { params: { plan_id: planId } })
  return data
}

/** Paginated list of every installment due org-wide, with each row's
 * invoice number embedded via a real join — for the Installments page. */
export async function fetchInstallmentsPaginated(params: ListParams): Promise<PaginatedResponse<InstallmentWithInvoice>> {
  const { data } = await api.get<PaginatedResponse<InstallmentWithInvoice>>("/database/installments", { params })
  return data
}

export async function createInstallment(
  input: Partial<Installment> & { plan_id: string; invoice_id: string },
): Promise<Installment> {
  const { data } = await api.post<Installment>("/database/installments", input)
  return data
}

// No update/delete: an installment's status only ever changes via the
// payments_mark_installment_paid DB trigger, driven by recording a payment
// against it.
