"use client"

import { useTranslations } from "next-intl"
import { PlusIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { StatusBadge } from "@/components/status-badge"
import { useVendors } from "@/hooks/use-vendors"
import { usePurchaseBillsList } from "@/hooks/use-purchase-bills"
import { routes } from "@/lib/routes"
import type { PurchaseBill } from "@/lib/database/types"

const columnHelper = entityColumnHelper<PurchaseBill>()
const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PurchaseBillsPage() {
  const t = useTranslations("PurchaseBills")
  const tStatus = useTranslations("DocStatus")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = usePurchaseBillsList(params)
  const { data: vendors } = useVendors()

  const vendorName = (id: string) => vendors?.find((v) => v.id === id)?.name ?? "—"

  const columns = [
    columnHelper.accessor("bill_number", {
      header: t("columnNumber"),
      cell: ({ getValue, row }) => (
        <Link href={routes.purchases.bills.detail(row.original.id)} className="font-medium hover:underline">
          {getValue() ?? "—"}
        </Link>
      ),
    }),
    columnHelper.accessor("vendor_id", {
      header: t("columnVendor"),
      cell: ({ getValue }) => vendorName(getValue()),
    }),
    columnHelper.accessor("vendor_invoice_number", {
      header: t("columnVendorRef"),
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ?? "—"}</span>,
    }),
    columnHelper.accessor("bill_date", { header: t("columnBillDate") }),
    columnHelper.accessor("status", {
      header: t("columnStatus"),
      cell: ({ getValue }) => <StatusBadge status={getValue()}>{tStatus(getValue())}</StatusBadge>,
    }),
    columnHelper.accessor("total", {
      header: t("columnTotal"),
      cell: ({ getValue }) => <span className="font-medium">{money(getValue())}</span>,
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
          <Link href={routes.purchases.bills.new}>
            <PlusIcon />
            {t("newBill")}
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
