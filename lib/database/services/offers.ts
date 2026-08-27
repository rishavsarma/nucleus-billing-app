import { api } from "@/lib/axios"
import type { Offer } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all offers with no pagination — for dropdowns / pickers. */
export async function fetchOffersAll(): Promise<Offer[]> {
  const { data } = await api.get<Offer[]>("/database/offers", { params: { page: 1, pageSize: 9999 } })
  return (data as unknown as PaginatedResponse<Offer>).data
}

/** Fetch a single record by id — for detail pages, instead of pulling
 * every row via fetchOffersAll() and finding it client-side. */
export async function fetchOfferById(id: string): Promise<Offer> {
  const { data } = await api.get<Offer>("/database/offers", { params: { id } })
  return data
}

/** Fetch a paginated + searched page of offers. */
export async function fetchOffersPaginated(params: ListParams): Promise<PaginatedResponse<Offer>> {
  const { data } = await api.get<PaginatedResponse<Offer>>("/database/offers", { params })
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
