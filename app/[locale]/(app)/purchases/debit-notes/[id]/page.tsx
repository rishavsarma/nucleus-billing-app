import { getTranslations } from "next-intl/server"

export default async function DebitNotesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations("PageTitles")
  const tPlaceholder = await getTranslations("PlaceholderPage")

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">{t("debitNotes")}</h1>
      <p className="text-muted-foreground text-sm">{tPlaceholder("todoDetail", { id })}</p>
    </div>
  )
}
