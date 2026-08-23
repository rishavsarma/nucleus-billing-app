"use client"

import { useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import { usePathname, useRouter } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const [isPending, startTransition] = useTransition()

  return (
    <Select
      value={locale}
      disabled={isPending}
      onValueChange={(nextLocale) => {
        startTransition(() => {
          router.replace(
            // @ts-expect-error -- params matches the pathname's dynamic segments
            { pathname, params },
            { locale: nextLocale },
          )
        })
      }}
    >
      <SelectTrigger aria-label={t("label")} size="sm" className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {routing.locales.map((cur) => (
          <SelectItem key={cur} value={cur}>
            {t(cur)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
