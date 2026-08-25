"use client"

import { useTranslations } from "next-intl"
import { PlusIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { routes } from "@/lib/routes"
import { Button } from "@/components/ui/button"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { StatusBadge } from "@/components/status-badge"
import { useOrganizations } from "@/hooks/use-organizations"
import type { Organization } from "@/lib/database/types"

const columnHelper = entityColumnHelper<Organization>()

const SUBSCRIPTION_STATUS_LABEL_KEY = {
  trialing: "statusTrialing",
  active: "statusActive",
  past_due: "statusPastDue",
  cancelled: "statusCancelled",
} as const

export default function AdminOrganizationsPage() {
  const t = useTranslations("AdminOrganizations")
  const tCommon = useTranslations("Common")
  const { data: organizations, isLoading } = useOrganizations()

  const columns = [
    columnHelper.accessor("name", {
      header: t("columnName"),
      cell: ({ getValue, row }) => (
        <Link href={routes.admin.organizations.detail(row.original.id)} className="font-medium hover:underline">
          {getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor("is_active", {
      header: t("columnStatus"),
      cell: ({ getValue }) => (
        <StatusBadge status={getValue() ? "active" : "inactive"}>
          {getValue() ? tCommon("yes") : tCommon("no")}
        </StatusBadge>
      ),
    }),
    columnHelper.accessor("subscription_status", {
      header: t("columnSubscription"),
      cell: ({ getValue }) => (
        <StatusBadge status={getValue()}>{t(SUBSCRIPTION_STATUS_LABEL_KEY[getValue()])}</StatusBadge>
      ),
    }),
    columnHelper.accessor("created_at", {
      header: t("columnCreated"),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{new Date(getValue()).toLocaleDateString()}</span>
      ),
    }),
  ]

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild>
          <Link href={routes.admin.organizations.new}>
            <PlusIcon />
            {t("newOrganization")}
          </Link>
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={organizations ?? []}
        isLoading={isLoading}
        searchPlaceholder={t("searchPlaceholder")}
        matchesSearch={(row, query) => row.name.toLowerCase().includes(query)}
        emptyMessage={t("noResults")}
      />
    </div>
  )
}
