"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchProfile, updateProfileDetails, updateEmail, updatePassword } from "@/lib/services/profile"

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  })
}

export function useUpdateProfileDetails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProfileDetails,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      queryClient.invalidateQueries({ queryKey: ["me"] })
    },
  })
}

export function useUpdateEmail() {
  return useMutation({
    mutationFn: updateEmail,
  })
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: updatePassword,
  })
}
