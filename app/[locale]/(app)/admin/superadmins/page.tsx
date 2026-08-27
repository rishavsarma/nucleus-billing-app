"use client"

import { useTranslations } from "next-intl"
import { ShieldIcon } from "lucide-react"

import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { useEnrichedSuperadmins } from "@/hooks/use-superadmins-enriched"
import type { EnrichedSuperadmin } from "@/lib/services/superadmins-enriched"

type SuperadminRow = EnrichedSuperadmin & { id: string }

const columnHelper = entityColumnHelper<SuperadminRow>()

export default function SuperadminsPage() {
  const t = useTranslations("AdminSuperadmins")
  const { tableControlProps } = useServerTableParams()
  const { data: superadmins, isLoading } = useEnrichedSuperadmins()

  const rows: SuperadminRow[] = (superadmins ?? []).map((s) => ({ ...s, id: s.user_id }))

  const columns = [
    columnHelper.accessor("email", {
      header: t("columnUser"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-muted">
            <ShieldIcon className="size-3.5 text-muted-foreground" />
          </div>
          <span className="font-medium">{row.original.email ?? row.original.user_id}</span>
        </div>
      ),
    }),
    columnHelper.accessor("created_at", {
      header: t("columnGranted"),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{new Date(getValue()).toLocaleDateString()}</span>
      ),
    }),
  ]

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <EntityTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        totalCount={rows.length}
        {...tableControlProps}
        showSearch={false}
        emptyMessage={t("noResults")}
      />

      <p className="mt-2 text-xs text-muted-foreground">{t("noAddUiNote")}</p>
    </div>
  )
}
