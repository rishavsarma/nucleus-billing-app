"use client"

import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { StatusBadge } from "@/components/status-badge"
import { useInstallmentsList } from "@/hooks/use-installments"
import { useInvoices } from "@/hooks/use-invoices"
import { routes } from "@/lib/routes"
import type { Installment } from "@/lib/database/types"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const columnHelper = entityColumnHelper<Installment>()

export default function InstallmentsPage() {
  const t = useTranslations("Emi")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = useInstallmentsList(params)
  const { data: invoices } = useInvoices()

  const today = new Date().toISOString().slice(0, 10)

  const columns = [
    columnHelper.accessor("invoice_id", {
      header: t("columnInvoice"),
      cell: ({ getValue }) => {
        const invoice = invoices?.find((inv) => inv.id === getValue())
        return (
          <Link href={routes.sales.invoices.detail(getValue())} className="font-medium hover:underline">
            {invoice?.invoice_number ?? "—"}
          </Link>
        )
      },
    }),
    columnHelper.accessor("installment_number", {
      header: t("columnInstallment"),
      cell: ({ getValue }) => `#${getValue()}`,
    }),
    columnHelper.accessor("due_date", {
      header: t("columnDueDate"),
    }),
    columnHelper.accessor("amount", {
      header: t("columnAmount"),
      cell: ({ getValue }) => <span className="font-medium">{money(getValue())}</span>,
    }),
    columnHelper.display({
      id: "status",
      header: t("columnStatus"),
      cell: ({ row }) => {
        const installment = row.original
        const isOverdue = installment.status === "pending" && installment.due_date < today
        if (installment.status === "paid") return <StatusBadge status="paid">{t("statusPaid")}</StatusBadge>
        if (isOverdue) return <StatusBadge status="overdue">{t("statusOverdue")}</StatusBadge>
        return <StatusBadge status="pending">{t("statusPending")}</StatusBadge>
      },
    }),
  ]

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{t("listTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("listDescription")}</p>
      </div>

      <EntityTable
        columns={columns}
        data={result?.data ?? []}
        isLoading={isLoading}
        totalCount={result?.total ?? 0}
        {...tableControlProps}
        showSearch={false}
        emptyMessage={t("noResults")}
      />
    </div>
  )
}
