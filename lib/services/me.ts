import { api } from "@/lib/axios"

export type OrgStatus = {
  isActive: boolean
  subscriptionStatus: "trialing" | "active" | "past_due" | "cancelled"
  subscriptionCurrentPeriodEnd: string | null
}

export type Me = {
  userId: string
  orgId: string | null
  isSuperadmin: boolean
  orgStatus: OrgStatus | null
}

export async function fetchMe(): Promise<Me> {
  const { data } = await api.get<Me>("/me")
  return data
}
