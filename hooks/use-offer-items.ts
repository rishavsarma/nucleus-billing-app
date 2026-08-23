"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchOfferItems,
  createOfferItem,
  deleteOfferItem,
} from "@/lib/database/services/offer-items"
import type { OfferItem } from "@/lib/database/types"

export function useOfferItems(offerId: string | undefined) {
  return useQuery({
    queryKey: ["offer-items", offerId],
    queryFn: () => fetchOfferItems(offerId!),
    enabled: !!offerId,
  })
}

export function useCreateOfferItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OfferItem) => createOfferItem(input),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["offer-items", variables.offer_id] }),
  })
}

// No update mutation: offer_items has no columns beyond its (offer_id, item_id) key.

export function useDeleteOfferItem(offerId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => deleteOfferItem(offerId!, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["offer-items", offerId] }),
  })
}
