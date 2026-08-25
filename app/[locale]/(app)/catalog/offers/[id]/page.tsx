import { OfferDetailClient } from "./offer-detail-client"

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OfferDetailClient id={id} />
}
