import { PurchaseBillDetailClient } from "./purchase-bill-detail-client"

export default async function PurchaseBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PurchaseBillDetailClient id={id} />
}
