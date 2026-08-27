import { SalesReturnDetailClient } from "./sales-return-detail-client"

export default async function SalesReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SalesReturnDetailClient id={id} />
}
