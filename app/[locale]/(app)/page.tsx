import { useTranslations } from "next-intl"

export default function DashboardPage() {
  const t = useTranslations("PageTitles")
  const tPlaceholder = useTranslations("PlaceholderPage")

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">{t("dashboard")}</h1>
      <p className="text-sm text-muted-foreground">
        {tPlaceholder("comingSoon")}
      </p>
    </div>
  )
}
