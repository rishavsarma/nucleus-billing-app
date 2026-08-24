"use client"

import { useMutation } from "@tanstack/react-query"
import { login } from "@/lib/services/auth"

export function useLogin() {
  return useMutation({
    mutationFn: login,
  })
}
