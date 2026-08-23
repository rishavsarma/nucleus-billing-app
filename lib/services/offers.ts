import { api } from "@/lib/axios"
import type { Offer } from "@/lib/billing/types"

export async function fetchOffers(): Promise<Offer[]> {
  const { data } = await api.get<Offer[]>("/billing/offers")
  return data
}

export async function createOffer(input: Partial<Offer>): Promise<Offer> {
  const { data } = await api.post<Offer>("/billing/offers", input)
  return data
}

export async function updateOffer(id: string, input: Partial<Offer>): Promise<Offer> {
  const { data } = await api.put<Offer>("/billing/offers", input, { params: { id } })
  return data
}

export async function deleteOffer(id: string): Promise<void> {
  await api.delete("/billing/offers", { params: { id } })
}
