"use client"

import { useTranslations } from "next-intl"
import { EyeIcon, PlusIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { StatusBadge } from "@/components/status-badge"
import { useInvoicesList } from "@/hooks/use-invoices"
import { routes } from "@/lib/routes"
import type { InvoiceWithCustomer } from "@/lib/database/types"

const columnHelper = entityColumnHelper<InvoiceWithCustomer>()
const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function InvoicesPage() {
  const t = useTranslations("Invoices")
  const tStatus = useTranslations("DocStatus")
  const tCommon = useTranslations("Common")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = useInvoicesList(params)

  const columns = [
    columnHelper.accessor("invoice_number", {
      header: t("columnNumber"),
      cell: ({ getValue, row }) => (
        <Link href={routes.sales.invoices.detail(row.original.id)} className="font-medium hover:underline">
          {getValue() ?? "—"}
        </Link>
      ),
    }),
    columnHelper.accessor("customer.name", {
      id: "customer_id",
      header: t("columnCustomer"),
      cell: ({ getValue }) => getValue() ?? "—",
    }),
    columnHelper.accessor("issue_date", { header: t("columnIssueDate") }),
    columnHelper.accessor("due_date", {
      header: t("columnDueDate"),
      cell: ({ getValue }) => getValue() ?? "—",
    }),
    columnHelper.accessor("status", {
      header: t("columnStatus"),
      cell: ({ getValue }) => <StatusBadge status={getValue()}>{tStatus(getValue())}</StatusBadge>,
    }),
    columnHelper.accessor("total", {
      header: t("columnTotal"),
      cell: ({ getValue }) => <span className="font-medium">{money(getValue())}</span>,
    }),
    columnHelper.display({
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link
              href={routes.sales.invoices.detail(row.original.id)}
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
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild>
          <Link href={routes.sales.invoices.new}>
            <PlusIcon />
            {t("newInvoice")}
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
