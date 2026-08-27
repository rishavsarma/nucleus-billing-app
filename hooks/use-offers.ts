"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchOffersAll, fetchOfferById, fetchOffersPaginated, createOffer, updateOffer, deleteOffer } from "@/lib/database/services/offers"
import type { Offer } from "@/lib/database/types"

/** All records — use in dropdowns/pickers where you need every option. */
export function useOffers() {
  return useQuery({
    queryKey: ["offers", "all"],
    queryFn: fetchOffersAll,
  })
}

/** Paginated + searched list — use in list-view table pages. */
export function useOffersList(params: ListParams) {
  return useQuery({
    queryKey: ["offers", "list", params],
    queryFn: () => fetchOffersPaginated(params),
  })
}

/** Single record by id — for detail pages. */
export function useOffer(id: string) {
  return useQuery({
    queryKey: ["offers", "detail", id],
    queryFn: () => fetchOfferById(id),
    enabled: !!id,
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
