"use client"

import { useTranslations } from "next-intl"

import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { StatusBadge } from "@/components/status-badge"
import { useItemStockList } from "@/hooks/use-item-stock"
import { useWarehouses } from "@/hooks/use-warehouses"
import type { ItemStockRow } from "@/lib/database/types"

type StockRow = ItemStockRow & { id: string }

const columnHelper = entityColumnHelper<StockRow>()

export default function StockPage() {
  const t = useTranslations("Stock")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = useItemStockList(params)
  const { data: warehouses } = useWarehouses()

  const warehouseById = new Map((warehouses ?? []).map((w) => [w.id, w]))
  const rows: StockRow[] = (result?.data ?? []).map((row) => ({
    ...row,
    id: `${row.item_id}:${row.warehouse_id}`,
  }))

  const columns = [
    columnHelper.accessor("item_name", {
      header: t("columnItem"),
      cell: ({ getValue, row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{getValue()}</span>
          <span className="text-xs text-muted-foreground">{row.original.item_sku ?? ""}</span>
        </div>
      ),
    }),
    columnHelper.accessor("warehouse_id", {
      header: t("columnWarehouse"),
      cell: ({ getValue }) => warehouseById.get(getValue())?.name ?? "—",
    }),
    columnHelper.accessor("quantity_on_hand", {
      header: t("columnQuantity"),
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    }),
    columnHelper.accessor("item_reorder_level", {
      header: t("columnReorderLevel"),
      cell: ({ getValue }) => getValue() ?? "—",
    }),
    columnHelper.display({
      id: "status",
      header: t("columnStatus"),
      cell: ({ row }) => {
        const isLow = row.original.quantity_on_hand <= row.original.item_reorder_level
        return <StatusBadge status={isLow ? "low" : "ok"}>{isLow ? t("statusLow") : t("statusOk")}</StatusBadge>
      },
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
        totalCount={result?.total ?? 0}
        {...tableControlProps}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("noResults")}
      />
    </div>
  )
}
