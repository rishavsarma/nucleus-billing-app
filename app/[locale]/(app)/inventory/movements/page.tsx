"use client"

import { useTranslations } from "next-intl"
import { PlusIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { useStockMovementsList } from "@/hooks/use-stock-movements"
import { routes } from "@/lib/routes"
import type { StockMovementWithRelations } from "@/lib/database/types"

const columnHelper = entityColumnHelper<StockMovementWithRelations>()

// credit_note/debit_note reference_type values only ever existed on rows
// written before db-schema/010_returns_split.sql, which renamed the
// physical-return tables to sales_returns/purchase_returns and backfilled
// every existing stock_movements row to match — so new rows never carry
// the old values, but old rows read back before the migration runs still
// need somewhere to route to.
const REFERENCE_ROUTE: Record<string, (id: string) => string> = {
  invoice: (id) => routes.sales.invoices.detail(id),
  purchase_bill: (id) => routes.purchases.bills.detail(id),
  sales_return: (id) => routes.sales.salesReturns.detail(id),
  purchase_return: (id) => routes.purchases.purchaseReturns.detail(id),
  credit_note: (id) => routes.sales.salesReturns.detail(id),
  debit_note: (id) => routes.purchases.purchaseReturns.detail(id),
}

export default function StockMovementsPage() {
  const t = useTranslations("StockMovements")
  const tTypes = useTranslations("MovementTypes")
  const tReference = useTranslations("ReferenceTypes")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = useStockMovementsList(params)

  const columns = [
    columnHelper.accessor("created_at", {
      header: t("columnDate"),
      cell: ({ getValue }) => getValue().slice(0, 10),
    }),
    columnHelper.accessor("movement_type", {
      header: t("columnType"),
      cell: ({ getValue }) => <Badge variant="outline">{tTypes(getValue())}</Badge>,
    }),
    columnHelper.accessor("item.name", {
      id: "item_id",
      header: t("columnItem"),
      cell: ({ getValue }) => getValue() ?? "—",
    }),
    columnHelper.accessor("warehouse.name", {
      id: "warehouse_id",
      header: t("columnWarehouse"),
      cell: ({ getValue }) => getValue() ?? "—",
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
              {tReference(reference_type!)}
            </Link>
          )
        }
        return <span className="text-muted-foreground">{notes ?? (reference_type ? tReference(reference_type) : "—")}</span>
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
        data={result?.data ?? []}
        isLoading={isLoading}
        totalCount={result?.total ?? 0}
        {...tableControlProps}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("noResults")}
      />
    </div>
  )
}
