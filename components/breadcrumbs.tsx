"use client"

import { useTranslations } from "next-intl"

import { Link, usePathname } from "@/i18n/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { matchNavEntry } from "@/lib/nav-data"

export function Breadcrumbs() {
  const pathname = usePathname()
  const t = useTranslations("Sidebar")
  const tCommon = useTranslations("Common")

  const match = matchNavEntry(pathname)
  if (!match) return null

  const { group, item } = match
  const remainder = pathname.slice(item.url.length).split("/").filter(Boolean)
  const isNew = remainder[0] === "new"
  const isItemCurrent = remainder.length === 0

  return (
    <Breadcrumb className="max-w-[200px] sm:max-w-none truncate">
      <BreadcrumbList className="flex-nowrap whitespace-nowrap">
        <BreadcrumbItem className="hidden sm:inline-flex">
          <span>{t(`groups.${group.labelKey}`)}</span>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden sm:inline-flex" />
        <BreadcrumbItem>
          {isItemCurrent ? (
            <BreadcrumbPage className="truncate max-w-[140px] sm:max-w-none">{t(`items.${item.titleKey}`)}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href={item.url} className="truncate max-w-[120px] sm:max-w-none">{t(`items.${item.titleKey}`)}</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {isNew ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{tCommon("new")}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
