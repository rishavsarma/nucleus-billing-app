"use client"

import { useTranslations } from "next-intl"
import { PlusIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { StatusBadge } from "@/components/status-badge"
import { useCustomers } from "@/hooks/use-customers"
import { useCreditNotesList } from "@/hooks/use-credit-notes"
import { useInvoices } from "@/hooks/use-invoices"
import { routes } from "@/lib/routes"
import type { CreditNote } from "@/lib/database/types"

const columnHelper = entityColumnHelper<CreditNote>()
const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CreditNotesPage() {
  const t = useTranslations("CreditNotes")
  const tStatus = useTranslations("DocStatus")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = useCreditNotesList(params)
  const { data: customers } = useCustomers()
  const { data: invoices } = useInvoices()

  const customerName = (id: string) => customers?.find((c) => c.id === id)?.name ?? "—"
  const invoiceNumber = (id: string) => invoices?.find((i) => i.id === id)?.invoice_number ?? "—"

  const columns = [
    columnHelper.accessor("credit_note_number", {
      header: t("columnNumber"),
      cell: ({ getValue, row }) => (
        <Link href={routes.sales.creditNotes.detail(row.original.id)} className="font-medium hover:underline">
          {getValue() ?? "—"}
        </Link>
      ),
    }),
    columnHelper.accessor("invoice_id", {
      header: t("columnInvoice"),
      cell: ({ getValue }) => invoiceNumber(getValue()),
    }),
    columnHelper.accessor("customer_id", {
      header: t("columnCustomer"),
      cell: ({ getValue }) => customerName(getValue()),
    }),
    columnHelper.accessor("issue_date", { header: t("columnIssueDate") }),
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
          <Link href={routes.sales.creditNotes.new}>
            <PlusIcon />
            {t("newCreditNote")}
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
