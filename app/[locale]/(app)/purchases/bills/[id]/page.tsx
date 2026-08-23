export default async function PurchaseBillsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">Purchase Bills</h1>
      <p className="text-muted-foreground text-sm">TODO: build the detail view for {id}.</p>
    </div>
  )
}
