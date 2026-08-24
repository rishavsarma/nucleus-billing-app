import { useTranslations } from "next-intl"

export default function AuthCodeErrorPage() {
  const t = useTranslations("AuthCodeError")

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground text-sm">{t("description")}</p>
    </div>
  )
}
