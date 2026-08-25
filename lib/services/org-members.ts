import { api } from "@/lib/axios"
import type { Membership } from "@/lib/database/types"

export type OrgMember = Membership & { email: string | null }

export async function fetchOrgMembers(): Promise<OrgMember[]> {
  const { data } = await api.get<OrgMember[]>("/org-members")
  return data
}
