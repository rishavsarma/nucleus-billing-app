import { api } from "@/lib/axios"
import type { Payment, PaymentWithRelations } from "@/lib/database/types"
import type {
  ListParams,
  PaginatedResponse,
} from "@/lib/database/list-params-types"

/** Fetch just the payments recorded against one invoice — for the invoice
 * detail page's payment history, scoped server-side rather than fetching
 * every payment in the org (pageSize: 9999) and filtering client-side. */
export async function fetchPaymentsByInvoiceId(
  invoiceId: string
): Promise<Payment[]> {
  const { data } = await api.get<Payment[]>("/database/payments", {
    params: { invoice_id: invoiceId },
  })
  return data
}

/** Fetch a paginated + searched page of payments, with each row's invoice
 * number and (nested) customer name embedded via real joins. */
export async function fetchPaymentsPaginated(
  params: ListParams
): Promise<PaginatedResponse<PaymentWithRelations>> {
  const { data } = await api.get<PaginatedResponse<PaymentWithRelations>>(
    "/database/payments",
    { params }
  )
  return data
}

/** `idempotencyKey`, when provided, is sent as the `Idempotency-Key` header
 * so a double-submit (double-click, a retried request after a dropped
 * response) replays the original result instead of recording the payment
 * twice — see app/api/database/payments/route.ts and lib/idempotency.ts. */
export async function createPayment(
  input: Partial<Payment>,
  idempotencyKey?: string
): Promise<Payment> {
  const { data } = await api.post<Payment>("/database/payments", input, {
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  })
  return data
}

export async function updatePayment(
  id: string,
  input: Partial<Payment>
): Promise<Payment> {
  const { data } = await api.put<Payment>("/database/payments", input, {
    params: { id },
  })
  return data
}

// No delete: payments are financial records and are never hard-deleted.
