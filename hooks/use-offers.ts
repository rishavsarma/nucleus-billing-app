"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchOffers, createOffer, updateOffer, deleteOffer } from "@/lib/database/services/offers"
import type { Offer } from "@/lib/database/types"

export function useOffers() {
  return useQuery({
    queryKey: ["offers"],
    queryFn: fetchOffers,
  })
}

export function useCreateOffer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Offer>) => createOffer(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["offers"] }),
  })
}

export function useUpdateOffer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Offer> }) => updateOffer(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["offers"] }),
  })
}

export function useDeleteOffer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteOffer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["offers"] }),
  })
}
