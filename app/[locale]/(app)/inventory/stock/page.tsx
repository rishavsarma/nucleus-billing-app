"use client"

import { useQueries } from "@tanstack/react-query"
import { useTranslations } from "next-intl"

import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { StatusBadge } from "@/components/status-badge"
import { useItems } from "@/hooks/use-items"
import { useWarehouses } from "@/hooks/use-warehouses"
import { fetchItemStock } from "@/lib/database/services/item-stock"
import type { Item, ItemStock, Warehouse } from "@/lib/database/types"

type StockRow = ItemStock & { id: string }

const columnHelper = entityColumnHelper<StockRow>()

export default function StockPage() {
  const t = useTranslations("Stock")
  const { data: items, isLoading: itemsLoading } = useItems()
  const { data: warehouses } = useWarehouses()

  // item_stock has no "list all" endpoint (item_id is a required query param
  // per app/api/database/item_stock/route.ts) — so fetch it per item, in
  // parallel, via useQueries rather than a single list hook.
  const stockQueries = useQueries({
    queries: (items ?? []).map((item) => ({
      queryKey: ["item-stock", item.id],
      queryFn: () => fetchItemStock(item.id),
      enabled: !!items,
    })),
  })

  const isLoading = itemsLoading || stockQueries.some((q) => q.isLoading)
  const rows: StockRow[] = stockQueries.flatMap((q) => q.data ?? []).map((row) => ({
    ...row,
    id: `${row.item_id}:${row.warehouse_id}`,
  }))

  const itemById = new Map<string, Item>((items ?? []).map((i) => [i.id, i]))
  const warehouseById = new Map<string, Warehouse>((warehouses ?? []).map((w) => [w.id, w]))

  const columns = [
    columnHelper.accessor("item_id", {
      header: t("columnItem"),
      cell: ({ getValue }) => {
        const item = itemById.get(getValue())
        return (
          <div className="flex flex-col">
            <span className="font-medium">{item?.name ?? "—"}</span>
            <span className="text-xs text-muted-foreground">{item?.sku ?? ""}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor("warehouse_id", {
      header: t("columnWarehouse"),
      cell: ({ getValue }) => warehouseById.get(getValue())?.name ?? "—",
    }),
    columnHelper.accessor("quantity_on_hand", {
      header: t("columnQuantity"),
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    }),
    columnHelper.accessor("item_id", {
      id: "reorderLevel",
      header: t("columnReorderLevel"),
      cell: ({ getValue }) => itemById.get(getValue())?.reorder_level ?? "—",
    }),
    columnHelper.display({
      id: "status",
      header: t("columnStatus"),
      cell: ({ row }) => {
        const item = itemById.get(row.original.item_id)
        const isLow = item ? row.original.quantity_on_hand <= item.reorder_level : false
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
        searchPlaceholder={t("searchPlaceholder")}
        matchesSearch={(row, query) => {
          const item = itemById.get(row.item_id)
          return (item?.name.toLowerCase().includes(query) ?? false) || (item?.sku?.toLowerCase().includes(query) ?? false)
        }}
        emptyMessage={t("noResults")}
      />
    </div>
  )
}
