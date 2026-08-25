import { api } from "@/lib/axios"
import type { Offer } from "@/lib/database/types"

export async function fetchOffers(): Promise<Offer[]> {
  const { data } = await api.get<Offer[]>("/database/offers")
  return data
}

export async function createOffer(input: Partial<Offer>): Promise<Offer> {
  const { data } = await api.post<Offer>("/database/offers", input)
  return data
}

export async function updateOffer(id: string, input: Partial<Offer>): Promise<Offer> {
  const { data } = await api.put<Offer>("/database/offers", input, { params: { id } })
  return data
}

export async function deleteOffer(id: string): Promise<void> {
  await api.delete("/database/offers", { params: { id } })
}
