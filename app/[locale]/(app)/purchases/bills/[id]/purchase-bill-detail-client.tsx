"use client"

import { useState } from "react"
import { isAxiosError } from "axios"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon, BanknoteIcon, CheckIcon, MoreHorizontalIcon, XIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { DocumentStepper, type StepperStep } from "@/components/document-stepper"
import { PurchaseBillItemsSection } from "@/components/purchase-bill-items-section"
import { RecordPaymentDialog } from "@/components/record-payment-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { useVendors } from "@/hooks/use-vendors"
import { usePurchaseBills, useUpdatePurchaseBill } from "@/hooks/use-purchase-bills"
import { useCreatePurchasePayment, usePurchasePayments } from "@/hooks/use-purchase-payments"
import { useWarehouses } from "@/hooks/use-warehouses"
import { routes } from "@/lib/routes"
import type { PurchasePayment } from "@/lib/database/types"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const PAYMENT_METHODS = ["bank_transfer", "cash", "upi", "cheque", "other"]

export function PurchaseBillDetailClient({ id }: { id: string }) {
  const t = useTranslations("PurchaseBills")
  const tStatus = useTranslations("DocStatus")
  const tCommon = useTranslations("Common")
  const tMethods = useTranslations("PaymentMethods")

  const { data: bills, isLoading } = usePurchaseBills()
  const { data: vendors } = useVendors()
  const { data: warehouses } = useWarehouses()
  const { data: allPayments } = usePurchasePayments()
  const updateBill = useUpdatePurchaseBill()
  const createPayment = useCreatePurchasePayment()

  const [confirmVoid, setConfirmVoid] = useState(false)
  const [showRecordPayment, setShowRecordPayment] = useState(false)

  const bill = bills?.find((b) => b.id === id)
  const payments = allPayments?.filter((p) => p.purchase_bill_id === id) ?? []

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
  }

  if (!bill) {
    return (
      <div className="flex flex-col gap-2">
        <Link href={routes.purchases.bills.list} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          {t("backToList")}
        </Link>
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
      </div>
    )
  }

  const vendor = vendors?.find((v) => v.id === bill.vendor_id)
  const isDraft = bill.status === "draft"
  const isVoid = bill.status === "void"
  const isPaid = bill.status === "paid"
  const canRecordPayment = !isDraft && !isVoid
  const balanceDue = bill.total - bill.amount_paid

  const stage = isDraft ? 0 : isPaid ? 2 : 1
  const steps: StepperStep[] = [
    { label: t("stepDraft"), done: stage > 0, current: stage === 0 },
    { label: t("stepReceived"), done: stage > 1, current: stage === 1 },
    { label: t("stepPaid"), done: false, current: stage === 2 },
  ]

  function confirmBill() {
    updateBill.mutate(
      { id, input: { status: "received" } },
      {
        onSuccess: () => toast.success(tCommon("updatedSuccess")),
        onError: (error) => {
          const message = isAxiosError<{ error?: string }>(error) ? error.response?.data?.error : undefined
          toast.error(message ?? tCommon("genericError"))
        },
      },
    )
  }

  function voidBill() {
    updateBill.mutate(
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
      <Link href={routes.purchases.bills.list} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold">{bill.bill_number ?? "—"}</h1>
            <StatusBadge status={bill.status}>{tStatus(bill.status)}</StatusBadge>
          </div>
          <p className="text-sm text-muted-foreground">
            {vendor?.name ?? "—"} • {t("billDateLabel")} {bill.bill_date}
            {bill.due_date ? ` • ${t("dueDateLabel")} ${bill.due_date}` : ""}
            {bill.vendor_invoice_number ? ` • ${t("vendorInvoiceNumberLabel")} ${bill.vendor_invoice_number}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDraft ? (
            <Button onClick={confirmBill} disabled={updateBill.isPending}>
              <CheckIcon />
              {t("confirmBill")}
            </Button>
          ) : null}
          {canRecordPayment ? (
            <Button variant="outline" onClick={() => setShowRecordPayment(true)}>
              <BanknoteIcon />
              {t("recordPayment")}
            </Button>
          ) : null}
          {!isVoid ? (
            <Button variant="destructive" size="icon" onClick={() => setConfirmVoid(true)} title={t("voidBill")}>
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
          <PurchaseBillItemsSection purchaseBillId={id} editable={isDraft} />
          {bill.notes ? (
            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="mb-2 text-sm font-semibold">{t("notesLabel")}</h2>
              <p className="text-sm text-muted-foreground">{bill.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 text-sm font-semibold">{t("summaryTitle")}</h2>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotalLabel")}</span>
                <span>{money(bill.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("taxLabel")}</span>
                <span>{money(bill.tax_total)}</span>
              </div>
              <div className="my-1.5 border-t" />
              <div className="flex justify-between text-base font-semibold">
                <span>{t("totalLabel")}</span>
                <span>{money(bill.total)}</span>
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                <span>{t("amountPaidLabel")}</span>
                <span>{money(bill.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold">
                <span>{t("balanceDueLabel")}</span>
                <span>{money(balanceDue)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("noDiscountNote")}</p>
            </div>
          </div>

          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 text-sm font-semibold">{t("paymentsTitle")}</h2>
            {payments.length ? (
              <div className="flex flex-col gap-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between text-sm">
                    <div className="flex flex-col">
                      <span>{payment.paid_at.slice(0, 10)}</span>
                      <span className="text-xs text-muted-foreground">
                        {tMethods(payment.method)}
                        {payment.reference ? ` • ${payment.reference}` : ""}
                      </span>
                    </div>
                    <span className="font-medium">{money(payment.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
            )}
          </div>

          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <MoreHorizontalIcon className="size-4" />
              {t("detailsTitle")}
            </h2>
            <div className="flex flex-col gap-2 text-xs">
              {isDraft ? (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t("warehouseLabel")}</span>
                  <Select
                    value={bill.warehouse_id ?? undefined}
                    onValueChange={(value) =>
                      updateBill.mutate(
                        { id, input: { warehouse_id: value } },
                        { onError: () => toast.error(tCommon("genericError")) },
                      )
                    }
                  >
                    <SelectTrigger className="h-7 w-full text-xs">
                      <SelectValue placeholder={t("warehousePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("warehouseLabel")}</span>
                  <span>{warehouses?.find((w) => w.id === bill.warehouse_id)?.name ?? "—"}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("currencyLabel")}</span>
                <span>{bill.currency}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <RecordPaymentDialog
        open={showRecordPayment}
        onOpenChange={setShowRecordPayment}
        methods={PAYMENT_METHODS}
        balanceDue={balanceDue}
        isSubmitting={createPayment.isPending}
        onSubmit={(values) =>
          createPayment.mutate(
            {
              purchase_bill_id: id,
              amount: values.amount,
              method: values.method as PurchasePayment["method"],
              reference: values.reference || null,
              notes: values.notes || null,
              paid_at: values.paid_at,
            },
            {
              onSuccess: () => {
                toast.success(tCommon("createdSuccess"))
                setShowRecordPayment(false)
              },
              onError: () => toast.error(tCommon("genericError")),
            },
          )
        }
      />

      <DeleteConfirmDialog
        open={confirmVoid}
        onOpenChange={setConfirmVoid}
        isDeleting={updateBill.isPending}
        title={t("voidConfirmTitle")}
        description={t("voidConfirmDescription")}
        onConfirm={voidBill}
      />
    </div>
  )
}
