import { api } from "@/lib/axios"
import type { Membership } from "@/lib/database/types"

export type CreateOrgUserInput = {
  orgId: string
  email: string
  role: Membership["role"]
}

export type CreateOrgUserResult = {
  userId: string
  email: string
  temporaryPassword: string
}

export async function createOrgUser(input: CreateOrgUserInput): Promise<CreateOrgUserResult> {
  const { data } = await api.post<CreateOrgUserResult>("/admin/org-users", input)
  return data
}
