"use client"

import { useTranslations } from "next-intl"

import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { Badge } from "@/components/ui/badge"
import { useVendors } from "@/hooks/use-vendors"
import { usePurchaseBills } from "@/hooks/use-purchase-bills"
import { usePurchasePaymentsList } from "@/hooks/use-purchase-payments"
import type { PurchasePayment } from "@/lib/database/types"

const columnHelper = entityColumnHelper<PurchasePayment>()
const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PurchasePaymentsPage() {
  const t = useTranslations("PurchasePayments")
  const tMethods = useTranslations("PaymentMethods")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = usePurchasePaymentsList(params)
  const { data: bills } = usePurchaseBills()
  const { data: vendors } = useVendors()

  const billNumber = (id: string) => bills?.find((b) => b.id === id)?.bill_number ?? "—"
  const vendorName = (billId: string) => {
    const bill = bills?.find((b) => b.id === billId)
    return bill ? (vendors?.find((v) => v.id === bill.vendor_id)?.name ?? "—") : "—"
  }

  const columns = [
    columnHelper.accessor("paid_at", {
      header: t("columnDate"),
      cell: ({ getValue }) => getValue().slice(0, 10),
    }),
    columnHelper.accessor("purchase_bill_id", {
      header: t("columnBill"),
      cell: ({ getValue }) => billNumber(getValue()),
    }),
    columnHelper.display({
      id: "vendor",
      header: t("columnVendor"),
      cell: ({ row }) => vendorName(row.original.purchase_bill_id),
    }),
    columnHelper.accessor("method", {
      header: t("columnMethod"),
      cell: ({ getValue }) => <Badge variant="outline">{tMethods(getValue())}</Badge>,
    }),
    columnHelper.accessor("reference", {
      header: t("columnReference"),
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ?? "—"}</span>,
    }),
    columnHelper.accessor("amount", {
      header: t("columnAmount"),
      cell: ({ getValue }) => <span className="font-medium">{money(getValue())}</span>,
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
