"use client"

import { useTranslations } from "next-intl"
import { PlusIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useItems } from "@/hooks/use-items"
import { useStockMovements } from "@/hooks/use-stock-movements"
import { useWarehouses } from "@/hooks/use-warehouses"
import { routes } from "@/lib/routes"
import type { StockMovement } from "@/lib/database/types"

const columnHelper = entityColumnHelper<StockMovement>()

const REFERENCE_ROUTE: Record<string, (id: string) => string> = {
  invoice: (id) => routes.sales.invoices.detail(id),
  purchase_bill: (id) => routes.purchases.bills.detail(id),
  credit_note: (id) => routes.sales.creditNotes.detail(id),
  debit_note: (id) => routes.purchases.debitNotes.detail(id),
}

export default function StockMovementsPage() {
  const t = useTranslations("StockMovements")
  const tTypes = useTranslations("MovementTypes")
  const { data: movements, isLoading } = useStockMovements()
  const { data: items } = useItems()
  const { data: warehouses } = useWarehouses()

  const itemName = (id: string) => items?.find((i) => i.id === id)?.name ?? "—"
  const warehouseName = (id: string) => warehouses?.find((w) => w.id === id)?.name ?? "—"

  const columns = [
    columnHelper.accessor("created_at", {
      header: t("columnDate"),
      cell: ({ getValue }) => getValue().slice(0, 10),
    }),
    columnHelper.accessor("movement_type", {
      header: t("columnType"),
      cell: ({ getValue }) => <Badge variant="outline">{tTypes(getValue())}</Badge>,
    }),
    columnHelper.accessor("item_id", {
      header: t("columnItem"),
      cell: ({ getValue }) => itemName(getValue()),
    }),
    columnHelper.accessor("warehouse_id", {
      header: t("columnWarehouse"),
      cell: ({ getValue }) => warehouseName(getValue()),
    }),
    columnHelper.accessor("quantity_delta", {
      header: t("columnQuantity"),
      cell: ({ getValue }) => {
        const value = getValue()
        return (
          <span className={value > 0 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-destructive"}>
            {value > 0 ? "+" : ""}
            {value}
          </span>
        )
      },
    }),
    columnHelper.display({
      id: "reference",
      header: t("columnReference"),
      cell: ({ row }) => {
        const { reference_type, reference_id, notes } = row.original
        const routeFn = reference_type ? REFERENCE_ROUTE[reference_type] : undefined
        if (routeFn && reference_id) {
          return (
            <Link href={routeFn(reference_id)} className="text-muted-foreground hover:underline">
              {reference_type}
            </Link>
          )
        }
        return <span className="text-muted-foreground">{notes ?? reference_type ?? "—"}</span>
      },
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
          <Link href={routes.inventory.movements.new}>
            <PlusIcon />
            {t("newAdjustment")}
          </Link>
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={movements ?? []}
        isLoading={isLoading}
        searchPlaceholder={t("searchPlaceholder")}
        matchesSearch={(row, query) => itemName(row.item_id).toLowerCase().includes(query)}
        emptyMessage={t("noResults")}
      />
    </div>
  )
}
