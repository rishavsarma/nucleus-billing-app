"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { StatusBadge } from "@/components/status-badge"
import { useDeleteItem, useItems } from "@/hooks/use-items"
import { useTaxRates } from "@/hooks/use-tax-rates"
import { routes } from "@/lib/routes"
import type { Item } from "@/lib/database/types"

const columnHelper = entityColumnHelper<Item>()
const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ItemsPage() {
  const t = useTranslations("Items")
  const tCommon = useTranslations("Common")
  const { data: items, isLoading } = useItems()
  const { data: taxRates } = useTaxRates()
  const deleteItem = useDeleteItem()
  const [toDelete, setToDelete] = useState<Item | null>(null)

  const taxRateName = (id: string | null) => taxRates?.find((r) => r.id === id)?.name

  const columns = [
    columnHelper.accessor("name", {
      header: t("columnName"),
      cell: ({ getValue, row }) => (
        <div className="flex flex-col">
          <Link href={routes.catalog.items.detail(row.original.id)} className="font-medium hover:underline">
            {getValue()}
          </Link>
          <span className="text-xs text-muted-foreground">{row.original.sku ?? ""}</span>
        </div>
      ),
    }),
    columnHelper.accessor("hsn_sac_code", {
      header: t("columnHsn"),
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ?? "—"}</span>,
    }),
    columnHelper.accessor("unit", { header: t("columnUnit") }),
    columnHelper.accessor("unit_price", {
      header: t("columnSellPrice"),
      cell: ({ getValue }) => <span className="font-medium">{money(getValue())}</span>,
    }),
    columnHelper.accessor("purchase_price", {
      header: t("columnCostPrice"),
      cell: ({ getValue }) => <span className="text-muted-foreground">{money(getValue())}</span>,
    }),
    columnHelper.accessor("tax_rate_id", {
      header: t("columnTax"),
      cell: ({ getValue }) => <span className="text-muted-foreground">{taxRateName(getValue()) ?? "—"}</span>,
    }),
    columnHelper.accessor("is_active", {
      header: t("columnStatus"),
      cell: ({ getValue }) => (
        <StatusBadge status={getValue() ? "active" : "inactive"}>
          {getValue() ? t("statusActive") : t("statusInactive")}
        </StatusBadge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={routes.catalog.items.detail(row.original.id)} onClick={(event) => event.stopPropagation()}>
              <PencilIcon />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation()
              setToDelete(row.original)
            }}
          >
            <TrashIcon />
          </Button>
        </div>
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
          <Link href={routes.catalog.items.new}>
            <PlusIcon />
            {t("newItem")}
          </Link>
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={items ?? []}
        isLoading={isLoading}
        searchPlaceholder={t("searchPlaceholder")}
        matchesSearch={(row, query) =>
          row.name.toLowerCase().includes(query) || (row.sku?.toLowerCase().includes(query) ?? false)
        }
        emptyMessage={t("noResults")}
      />

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteItem.isPending}
        description={t("deleteDescription")}
        onConfirm={() => {
          if (!toDelete) return
          deleteItem.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(tCommon("deletedSuccess"))
              setToDelete(null)
            },
            onError: () => toast.error(tCommon("genericError")),
          })
        }}
      />
    </div>
  )
}
