"use client"

import { useMutation } from "@tanstack/react-query"
import { createOrgUser } from "@/lib/services/admin-org-users"

export function useCreateOrgUser() {
  return useMutation({
    mutationFn: createOrgUser,
  })
}
