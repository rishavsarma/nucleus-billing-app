import type { Offer } from "@/lib/database/types"

export function calculateOfferDiscount(
  offer: Offer | undefined | null,
  subtotal: number,
  taxTotal: number = 0
): number {
  if (!offer || !offer.is_active) return 0
  const today = new Date().toISOString().slice(0, 10)
  if (offer.starts_at && offer.starts_at > today) return 0
  if (offer.ends_at && offer.ends_at < today) return 0

  if (offer.discount_type === "percentage") {
    return Math.round(((subtotal * offer.value) / 100) * 100) / 100
  }
  return Math.min(offer.value, subtotal + taxTotal)
}
