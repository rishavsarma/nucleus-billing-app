"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon, CheckIcon, XIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { SalesReturnItemsSection } from "@/components/sales-return-items-section"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { DocumentStepper, type StepperStep } from "@/components/document-stepper"
import { StatusBadge } from "@/components/status-badge"
import { useCustomers } from "@/hooks/use-customers"
import { useSalesReturn, useUpdateSalesReturn } from "@/hooks/use-sales-returns"
import { useInvoices } from "@/hooks/use-invoices"
import { useWarehouses } from "@/hooks/use-warehouses"
import { routes } from "@/lib/routes"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function SalesReturnDetailClient({ id }: { id: string }) {
  const t = useTranslations("SalesReturns")
  const tStatus = useTranslations("DocStatus")
  const tCommon = useTranslations("Common")

  const { data: salesReturn, isLoading } = useSalesReturn(id)
  const { data: customers } = useCustomers()
  const { data: invoices } = useInvoices()
  const { data: warehouses } = useWarehouses()
  const updateSalesReturn = useUpdateSalesReturn()
  const [confirmVoid, setConfirmVoid] = useState(false)

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
  }

  if (!salesReturn) {
    return (
      <div className="flex flex-col gap-2">
        <Link href={routes.sales.salesReturns.list} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          {t("backToList")}
        </Link>
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
      </div>
    )
  }

  const customer = customers?.find((c) => c.id === salesReturn.customer_id)
  const originalInvoice = invoices?.find((inv) => inv.id === salesReturn.invoice_id)
  const warehouse = warehouses?.find((w) => w.id === salesReturn.warehouse_id)
  const isDraft = salesReturn.status === "draft"
  const isVoid = salesReturn.status === "void"

  const steps: StepperStep[] = [
    { label: t("stepDraft"), done: !isDraft, current: isDraft },
    { label: t("stepIssued"), done: !isDraft, current: !isDraft },
  ]

  function issueSalesReturn() {
    updateSalesReturn.mutate(
      { id, input: { status: "issued" } },
      {
        onSuccess: () => toast.success(tCommon("updatedSuccess")),
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  function voidSalesReturn() {
    updateSalesReturn.mutate(
      { id, input: { status: "void" } },
      {
        onSuccess: () => {
          toast.success(tCommon("updatedSuccess"))
          setConfirmVoid(false)
        },
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Link href={routes.sales.salesReturns.list} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold">{salesReturn.sales_return_number ?? "—"}</h1>
            <StatusBadge status={salesReturn.status}>{tStatus(salesReturn.status)}</StatusBadge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("columnInvoice")} {originalInvoice?.invoice_number ?? "—"} • {customer?.name ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDraft ? (
            <Button onClick={issueSalesReturn} disabled={updateSalesReturn.isPending}>
              <CheckIcon />
              {t("issueSalesReturn")}
            </Button>
          ) : null}
          {!isVoid ? (
            <Button variant="destructive" size="icon" onClick={() => setConfirmVoid(true)} title={t("voidSalesReturn")}>
              <XIcon />
            </Button>
          ) : null}
        </div>
      </div>

      {!isVoid ? (
        <div className="mb-5">
          <DocumentStepper steps={steps} />
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 flex flex-col gap-5">
          <SalesReturnItemsSection salesReturnId={id} invoiceId={salesReturn.invoice_id} editable={isDraft} />
          {salesReturn.reason ? (
            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="mb-2 text-sm font-semibold">{t("reasonLabel")}</h2>
              <p className="text-sm text-muted-foreground">{salesReturn.reason}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 text-sm font-semibold">{t("summaryTitle")}</h2>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotalLabel")}</span>
                <span>{money(salesReturn.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("taxLabel")}</span>
                <span>{money(salesReturn.tax_total)}</span>
              </div>
              <div className="my-1.5 border-t" />
              <div className="flex justify-between text-base font-semibold">
                <span>{t("totalReturnLabel")}</span>
                <span>{money(salesReturn.total)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-2 text-sm font-semibold">{t("restockingTitle")}</h2>
            <p className="text-xs text-muted-foreground">
              {warehouse ? `${t("restockingNote")} (${warehouse.name})` : t("restockingNote")}
            </p>
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        open={confirmVoid}
        onOpenChange={setConfirmVoid}
        isDeleting={updateSalesReturn.isPending}
        title={t("voidConfirmTitle")}
        description={t("voidConfirmDescription")}
        onConfirm={voidSalesReturn}
      />
    </div>
  )
}
