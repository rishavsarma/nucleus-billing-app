import { api } from "@/lib/axios"

export type OrgStatus = {
  isActive: boolean
  subscriptionStatus: "trialing" | "active" | "past_due" | "cancelled"
  subscriptionCurrentPeriodEnd: string | null
}

export type Me = {
  userId: string
  email: string | null
  name: string | null
  orgId: string | null
  role: "owner" | "admin" | "member" | null
  isSuperadmin: boolean
  orgStatus: OrgStatus | null
}

export async function fetchMe(): Promise<Me> {
  const { data } = await api.get<Me>("/me")
  return data
}
