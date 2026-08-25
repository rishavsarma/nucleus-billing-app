"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchOrganizationAddonSubscriptions,
  subscribeToAddon,
  cancelAddon,
} from "@/lib/database/services/organization-addon-subscriptions"

export function useOrganizationAddonSubscriptions() {
  return useQuery({
    queryKey: ["organization-addon-subscriptions"],
    queryFn: fetchOrganizationAddonSubscriptions,
  })
}

export function useSubscribeToAddon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: subscribeToAddon,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organization-addon-subscriptions"] }),
  })
}

export function useCancelAddon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelAddon,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organization-addon-subscriptions"] }),
  })
}
