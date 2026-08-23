import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function Page() {
  const t = useTranslations("HomePage")

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">{t("title")}</h1>
          <p>{t("description")}</p>
          <p>{t("note")}</p>
          <Button className="mt-2">{t("button")}</Button>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {t.rich("themeHint", { kbd: (chunks) => <kbd>{chunks}</kbd> })}
        </div>
      </div>
    </div>
  )
}
