import { useTranslations } from "next-intl"

export default function PurchaseBillsPage() {
  const t = useTranslations("PageTitles")
  const tPlaceholder = useTranslations("PlaceholderPage")

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">{t("purchaseBills")}</h1>
      <p className="text-muted-foreground text-sm">{tPlaceholder("comingSoon")}</p>
    </div>
  )
}
