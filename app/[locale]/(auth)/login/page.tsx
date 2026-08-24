"use client"

import { useTranslations } from "next-intl"

import { LoginForm } from "@/components/login-form"
import { GalleryVerticalEndIcon } from "lucide-react"
import { ThemePresetSelector } from "@/components/theme-preset-selector"
import { ModeToggle } from "@/components/mode-toggle"

export default function LoginPage() {
  const tSidebar = useTranslations("Sidebar")
  const tLogin = useTranslations("LoginPage")

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
      <div className="relative hidden bg-muted lg:block">
          <ThemePresetSelector />
                 <ModeToggle />
      </div>
    </div>
  )
}
