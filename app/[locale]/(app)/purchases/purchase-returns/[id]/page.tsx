import { PurchaseReturnDetailClient } from "./purchase-return-detail-client"

export default async function PurchaseReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PurchaseReturnDetailClient id={id} />
}
