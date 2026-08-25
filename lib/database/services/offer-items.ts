import { api } from "@/lib/axios"
import type { OfferItem } from "@/lib/database/types"

export async function fetchOfferItems(offerId: string): Promise<OfferItem[]> {
  const { data } = await api.get<OfferItem[]>("/database/offer_items", {
    params: { offer_id: offerId },
  })
  return data
}

export async function createOfferItem(input: OfferItem): Promise<OfferItem> {
  const { data } = await api.post<OfferItem>("/database/offer_items", input)
  return data
}

// No update: offer_items is a pure (offer_id, item_id) link with no other columns.

export async function deleteOfferItem(offerId: string, itemId: string): Promise<void> {
  await api.delete("/database/offer_items", { params: { offer_id: offerId, item_id: itemId } })
}
