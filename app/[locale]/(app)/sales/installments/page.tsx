"use client"

import { useTranslations } from "next-intl"
import { EyeIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { StatusBadge } from "@/components/status-badge"
import { useInstallmentsList } from "@/hooks/use-installments"
import { routes } from "@/lib/routes"
import type { InstallmentWithInvoice } from "@/lib/database/types"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const columnHelper = entityColumnHelper<InstallmentWithInvoice>()

export default function InstallmentsPage() {
  const t = useTranslations("Emi")
  const tCommon = useTranslations("Common")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = useInstallmentsList(params)

  const today = new Date().toISOString().slice(0, 10)

  const columns = [
    columnHelper.accessor("invoice.invoice_number", {
      id: "invoice_id",
      header: t("columnInvoice"),
      cell: ({ getValue, row }) => (
        <Link href={routes.sales.invoices.detail(row.original.invoice_id)} className="font-medium hover:underline">
          {getValue() ?? "—"}
        </Link>
      ),
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
    columnHelper.display({
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link
              href={routes.sales.invoices.detail(row.original.invoice_id)}
              aria-label={tCommon("view")}
              onClick={(event) => event.stopPropagation()}
            >
              <EyeIcon />
            </Link>
          </Button>
        </div>
      ),
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
