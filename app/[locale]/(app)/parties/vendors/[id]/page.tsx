import { VendorDetailClient } from "./vendor-detail-client"

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VendorDetailClient id={id} />
}
