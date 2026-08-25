import { api } from "@/lib/axios"
import type { OrganizationAddonSubscription } from "@/lib/database/types"

export async function fetchOrganizationAddonSubscriptions(): Promise<OrganizationAddonSubscription[]> {
  const { data } = await api.get<OrganizationAddonSubscription[]>("/database/organization_addon_subscriptions")
  return data
}

export async function subscribeToAddon(input: { org_id: string; addon_slug: string }): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>("/database/organization_addon_subscriptions", input)
  return data
}

export async function cancelAddon(input: { org_id: string; addon_slug: string }): Promise<void> {
  await api.delete("/database/organization_addon_subscriptions", { params: input })
}
