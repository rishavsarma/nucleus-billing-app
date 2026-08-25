import { DebitNoteDetailClient } from "./debit-note-detail-client"

export default async function DebitNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DebitNoteDetailClient id={id} />
}
