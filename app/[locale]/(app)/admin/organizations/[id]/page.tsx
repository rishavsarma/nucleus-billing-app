import { AdminOrganizationDetailClient } from "./admin-organization-detail-client"

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AdminOrganizationDetailClient id={id} />
}
