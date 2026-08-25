"use client"

import { useTranslations } from "next-intl"
import { FileTextIcon, GalleryVerticalEndIcon, UsersIcon, WarehouseIcon } from "lucide-react"

import { LoginForm } from "@/components/login-form"
import { ThemePresetSelector } from "@/components/theme-preset-selector"
import { ModeToggle } from "@/components/mode-toggle"

export default function LoginPage() {
  const tSidebar = useTranslations("Sidebar")
  const t = useTranslations("LoginHero")

  const features = [
    { icon: FileTextIcon, title: t("feature1Title"), description: t("feature1Description") },
    { icon: WarehouseIcon, title: t("feature2Title"), description: t("feature2Description") },
    { icon: UsersIcon, title: t("feature3Title"), description: t("feature3Description") },
  ]

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEndIcon className="size-4" />
            </div>
            {tSidebar("brand")}
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>

      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
          <ThemePresetSelector />
          <ModeToggle />
        </div>

        <div className="relative z-10 mt-16 flex max-w-md flex-col gap-3">
          <h1 className="text-3xl font-semibold text-balance">{t("title")}</h1>
          <p className="text-sm text-balance text-primary-foreground/80">{t("subtitle")}</p>
        </div>

        <div className="relative z-10 flex flex-col gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 rounded-xl bg-primary-foreground/10 p-4 ring-1 ring-primary-foreground/15"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                <feature.icon className="size-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">{feature.title}</h2>
                <p className="text-xs text-primary-foreground/70">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
