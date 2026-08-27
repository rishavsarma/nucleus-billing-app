"use client"

import { useTranslations } from "next-intl"

import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { Badge } from "@/components/ui/badge"
import { usePaymentsList } from "@/hooks/use-payments"
import type { PaymentWithRelations } from "@/lib/database/types"

const columnHelper = entityColumnHelper<PaymentWithRelations>()
const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function SalesPaymentsPage() {
  const t = useTranslations("Payments")
  const tMethods = useTranslations("PaymentMethods")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = usePaymentsList(params)

  const columns = [
    columnHelper.accessor("paid_at", {
      header: t("columnDate"),
      cell: ({ getValue }) => getValue().slice(0, 10),
    }),
    columnHelper.accessor("invoice.invoice_number", {
      id: "invoice_id",
      header: t("columnInvoice"),
      cell: ({ getValue }) => getValue() ?? "—",
    }),
    columnHelper.accessor("invoice.customer.name", {
      id: "customer",
      header: t("columnCustomer"),
      cell: ({ getValue }) => getValue() ?? "—",
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
