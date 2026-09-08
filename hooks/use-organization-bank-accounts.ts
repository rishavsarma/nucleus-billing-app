"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchOrganizationBankAccountsAll,
  fetchOrganizationBankAccountsPaginated,
  createOrganizationBankAccount,
  updateOrganizationBankAccount,
  deleteOrganizationBankAccount,
} from "@/lib/database/services/organization-bank-accounts"
import type { OrganizationBankAccount } from "@/lib/database/types"

/** All accounts — use for the picker on invoice/purchase-bill forms. */
export function useOrganizationBankAccounts() {
  return useQuery({
    queryKey: ["organization-bank-accounts", "all"],
    queryFn: fetchOrganizationBankAccountsAll,
  })
}

/** Paginated + searched list — use in the settings list-view page. */
export function useOrganizationBankAccountsList(params: ListParams) {
  return useQuery({
    queryKey: ["organization-bank-accounts", "list", params],
    queryFn: () => fetchOrganizationBankAccountsPaginated(params),
  })
}

export function useCreateOrganizationBankAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<OrganizationBankAccount>) =>
      createOrganizationBankAccount(input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["organization-bank-accounts"],
      }),
  })
}

export function useUpdateOrganizationBankAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Partial<OrganizationBankAccount>
    }) => updateOrganizationBankAccount(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["organization-bank-accounts"],
      }),
  })
}

export function useDeleteOrganizationBankAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteOrganizationBankAccount(id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["organization-bank-accounts"],
      }),
  })
}
