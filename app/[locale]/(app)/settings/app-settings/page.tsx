"use client"

import { useTranslations } from "next-intl"

import { LanguageSwitcher } from "@/components/language-switcher"
import { ModeToggle } from "@/components/mode-toggle"
import { ThemePresetSelector } from "@/components/theme-preset-selector"
import { Field, FieldLabel } from "@/components/ui/field"

export default function AppSettingsPage() {
  const t = useTranslations("AppSettingsPage")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("appearanceTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("appearanceDescription")}</p>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <Field orientation="horizontal">
            <FieldLabel>{t("colorThemeLabel")}</FieldLabel>
            <div className="ml-auto">
              <ThemePresetSelector />
            </div>
          </Field>
          <Field orientation="horizontal">
            <FieldLabel>{t("modeLabel")}</FieldLabel>
            <div className="ml-auto">
              <ModeToggle />
            </div>
          </Field>
          <Field orientation="horizontal">
            <FieldLabel>{t("languageLabel")}</FieldLabel>
            <div className="ml-auto">
              <LanguageSwitcher />
            </div>
          </Field>
        </div>
      </div>
    </div>
  )
}
