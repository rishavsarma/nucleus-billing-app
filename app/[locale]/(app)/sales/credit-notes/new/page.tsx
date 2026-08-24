import { useTranslations } from "next-intl"

export default function NewCreditNotePage() {
  const t = useTranslations("PageTitles")
  const tPlaceholder = useTranslations("PlaceholderPage")

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">{t("newCreditNote")}</h1>
      <p className="text-muted-foreground text-sm">{tPlaceholder("todoForm")}</p>
    </div>
  )
}
