import { api } from "@/lib/axios"
import type { OrganizationBankAccount } from "@/lib/database/types"
import type {
  ListParams,
  PaginatedResponse,
} from "@/lib/database/list-params-types"

/** All of the org's bank accounts — used to populate the picker on
 * invoice/purchase-bill forms. Capped at 20, matching the same "safety
 * cap, not a claim this table is inherently small" pattern as
 * fetchPdfWatermarksAll(). */
export async function fetchOrganizationBankAccountsAll(): Promise<
  OrganizationBankAccount[]
> {
  const { data } = await api.get<PaginatedResponse<OrganizationBankAccount>>(
    "/database/organization_bank_accounts",
    {
      params: { page: 1, pageSize: 20 },
    }
  )
  return data.data
}

/** Fetch a paginated + searched page — for the settings list-view page. */
export async function fetchOrganizationBankAccountsPaginated(
  params: ListParams
): Promise<PaginatedResponse<OrganizationBankAccount>> {
  const { data } = await api.get<PaginatedResponse<OrganizationBankAccount>>(
    "/database/organization_bank_accounts",
    { params }
  )
  return data
}

export async function createOrganizationBankAccount(
  input: Partial<OrganizationBankAccount>
): Promise<OrganizationBankAccount> {
  const { data } = await api.post<OrganizationBankAccount>(
    "/database/organization_bank_accounts",
    input
  )
  return data
}

export async function updateOrganizationBankAccount(
  id: string,
  input: Partial<OrganizationBankAccount>
): Promise<OrganizationBankAccount> {
  const { data } = await api.put<OrganizationBankAccount>(
    "/database/organization_bank_accounts",
    input,
    { params: { id } }
  )
  return data
}

export async function deleteOrganizationBankAccount(id: string): Promise<void> {
  await api.delete("/database/organization_bank_accounts", { params: { id } })
}
