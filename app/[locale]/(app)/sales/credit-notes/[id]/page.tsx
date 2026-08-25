import { CreditNoteDetailClient } from "./credit-note-detail-client"

export default async function CreditNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CreditNoteDetailClient id={id} />
}
