"use client"

import { useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon, BanknoteIcon, CalendarClockIcon, CheckIcon, DownloadIcon, Loader2Icon, MoreHorizontalIcon, PrinterIcon, TruckIcon, XIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { DocumentStepper, type StepperStep } from "@/components/document-stepper"
import { InvoiceItemsSection } from "@/components/invoice-items-section"
import { RecordPaymentDialog } from "@/components/record-payment-dialog"
import { SetupEmiDialog } from "@/components/setup-emi-dialog"
import { OfferSelect } from "@/components/offer-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { useCustomer } from "@/hooks/use-customers"
import { useDeliveryByInvoice, useUpdateDelivery } from "@/hooks/use-deliveries"
import { useStaffMember } from "@/hooks/use-staff"
import { useCreateInstallmentPlan, useInstallmentPlanByInvoice } from "@/hooks/use-installment-plans"
import { useCreateInstallment, useInstallmentsByPlan } from "@/hooks/use-installments"
import { useInvoiceItems } from "@/hooks/use-invoice-items"
import { useInvoice, useUpdateInvoice } from "@/hooks/use-invoices"
import { fetchItemById } from "@/lib/database/services/items"
import { useOffer } from "@/hooks/use-offers"
import { useCurrentOrganization } from "@/hooks/use-organizations"
import { useActivePdfWatermarkText } from "@/hooks/use-pdf-watermarks"
import { useCreatePayment, usePaymentsByInvoice } from "@/hooks/use-payments"
import { WarehouseSelect } from "@/components/warehouse-select"
import { useWarehouse } from "@/hooks/use-warehouses"
import { buildInvoicePdfElement, downloadInvoicePdf, printInvoicePdf } from "@/lib/pdf/invoice-pdf"
import { routes } from "@/lib/routes"
import type { Installment, Payment } from "@/lib/database/types"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const PAYMENT_METHODS = ["manual", "bank_transfer", "cash", "upi", "razorpay"]

export function InvoiceDetailClient({ id }: { id: string }) {
  const t = useTranslations("Invoices")
  const tStatus = useTranslations("DocStatus")
  const tCommon = useTranslations("Common")
  const tMethods = useTranslations("PaymentMethods")
  const tPrint = useTranslations("InvoicePrint")
  const tDelivery = useTranslations("InvoiceDelivery")
  const tDeliveryStatus = useTranslations("DeliveryStatus")
  const tDeliveryPaymentMode = useTranslations("DeliveryPaymentMode")
  const tEmi = useTranslations("Emi")

  const { data: invoice, isLoading } = useInvoice(id)
  const { data: customer } = useCustomer(invoice?.customer_id)
  const { data: warehouse } = useWarehouse(invoice?.warehouse_id ?? undefined)
  const { data: appliedOffer } = useOffer(invoice?.offer_id ?? undefined)
  const { data: payments } = usePaymentsByInvoice(id)
  const { data: organization } = useCurrentOrganization()
  const { data: invoiceLineItems } = useInvoiceItems(id)
  // Only the specific items this invoice's lines reference — not the
  // whole catalog (pageSize: 9999) — resolved for the PDF's item details.
  const referencedItemIds = [
    ...new Set((invoiceLineItems ?? []).map((line) => line.item_id).filter((itemId): itemId is string => !!itemId)),
  ]
  const referencedItemQueries = useQueries({
    queries: referencedItemIds.map((itemId) => ({
      queryKey: ["items", "detail", itemId],
      queryFn: () => fetchItemById(itemId),
    })),
  })
  const referencedItems = referencedItemQueries.map((query) => query.data).filter((item) => !!item)
  const { data: delivery } = useDeliveryByInvoice(id)
  const { data: deliveryPerson } = useStaffMember(delivery?.delivery_person_id ?? undefined)
  const { data: emiPlan } = useInstallmentPlanByInvoice(id)
  const { data: installments } = useInstallmentsByPlan(emiPlan?.id)
  const watermarkText = useActivePdfWatermarkText()
  const updateInvoice = useUpdateInvoice()
  const updateDelivery = useUpdateDelivery()
  const createPayment = useCreatePayment()
  const createInstallmentPlan = useCreateInstallmentPlan()
  const createInstallment = useCreateInstallment()

  const [confirmVoid, setConfirmVoid] = useState(false)
  const [showRecordPayment, setShowRecordPayment] = useState(false)
  const [showSetupEmi, setShowSetupEmi] = useState(false)
  const [payingInstallment, setPayingInstallment] = useState<Installment | null>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isPreparingPrint, setIsPreparingPrint] = useState(false)

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
  }

  if (!invoice) {
    return (
      <div className="flex flex-col gap-2">
        <Link href={routes.sales.invoices.list} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          {t("backToList")}
        </Link>
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
      </div>
    )
  }

  const isDraft = invoice.status === "draft"
  const isVoid = invoice.status === "void"
  const isPaid = invoice.status === "paid"
  const isSentOrBeyond = !isDraft && !isVoid
  // Once an EMI plan exists, every payment must be recorded through a
  // specific installment's own "Pay" button (below) so it links via
  // installment_id and the DB trigger can mark that installment paid —
  // see db-schema/008_emi_installments.sql's comment on why installment
  // settlement is deliberately explicit/cashier-chosen rather than
  // auto-allocated. The generic Record Payment button bypasses that link
  // entirely: it still raises invoice.amount_paid (and can even flip the
  // invoice to "paid"), but leaves every installment row exactly as
  // pending as before, which is what caused the EMI schedule to keep
  // showing installments due after the invoice was already fully paid.
  const canRecordPayment = !isDraft && !isVoid && !emiPlan
  const balanceDue = invoice.total - invoice.amount_paid

  const steps: StepperStep[] = [
    { label: t("stepDraft"), done: !isDraft, current: isDraft },
    { label: t("stepSent"), done: isPaid, current: isSentOrBeyond && !isPaid },
    { label: t("stepPaid"), done: isPaid, current: isPaid },
  ]

  function confirmInvoice() {
    updateInvoice.mutate(
      { id, input: { status: "sent" } },
      {
        onSuccess: () => toast.success(tCommon("updatedSuccess")),
        onError: (error) => {
          const message = isAxiosError<{ error?: string }>(error) ? error.response?.data?.error : undefined
          toast.error(message ?? tCommon("genericError"))
        },
      },
    )
  }

  function voidInvoice() {
    updateInvoice.mutate(
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

  /** Creates the installment plan, then the N installment rows themselves —
   * amount is split evenly across months with the remainder absorbed by
   * the last installment so the schedule always sums exactly to the
   * invoice total regardless of rounding. Due dates step one calendar
   * month at a time from the chosen start date. */
  async function setupEmi(values: { months: number; start_date: string }) {
    try {
      const plan = await createInstallmentPlan.mutateAsync({
        invoice_id: id,
        total_amount: invoice!.total,
        months: values.months,
        start_date: values.start_date,
      })
      const base = Math.floor((invoice!.total / values.months) * 100) / 100
      let allocated = 0
      const startDate = new Date(values.start_date)
      for (let i = 0; i < values.months; i++) {
        const isLast = i === values.months - 1
        const amount = isLast ? Math.round((invoice!.total - allocated) * 100) / 100 : base
        allocated += amount
        const dueDate = new Date(startDate)
        dueDate.setMonth(dueDate.getMonth() + i)
        await createInstallment.mutateAsync({
          plan_id: plan.id,
          invoice_id: id,
          installment_number: i + 1,
          due_date: dueDate.toISOString().slice(0, 10),
          amount,
        })
      }
      toast.success(tEmi("setupSuccess"))
      setShowSetupEmi(false)
    } catch {
      toast.error(tCommon("genericError"))
    }
  }

  /** Renders the invoice as an actual PDF file client-side via
   * @react-pdf/renderer (not a browser print-to-PDF) and downloads it —
   * pixel-accurate layout and real embedded fonts/colors regardless of the
   * browser's print settings. */
  async function downloadPdf() {
    setIsGeneratingPdf(true)
    try {
      const element = await buildInvoicePdfElement({
        invoice: invoice!,
        customer,
        organization,
        lineItems: invoiceLineItems ?? [],
        items: referencedItems,
        tPrint,
        watermarkText,
      })
      await downloadInvoicePdf(element, `${invoice!.invoice_number ?? "invoice"}.pdf`)
    } catch {
      toast.error(tCommon("genericError"))
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  /** Same generated PDF, but opened straight into the browser's print
   * dialog via a hidden iframe instead of downloading — one click to print,
   * no intermediate "open the file, then print" step. */
  async function printPdf() {
    setIsPreparingPrint(true)
    try {
      const element = await buildInvoicePdfElement({
        invoice: invoice!,
        customer,
        organization,
        lineItems: invoiceLineItems ?? [],
        items: referencedItems,
        tPrint,
        watermarkText,
      })
      await printInvoicePdf(element)
    } catch {
      toast.error(tCommon("genericError"))
    } finally {
      setIsPreparingPrint(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Link href={routes.sales.invoices.list} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold">{invoice.invoice_number ?? "—"}</h1>
            <StatusBadge status={invoice.status}>{tStatus(invoice.status)}</StatusBadge>
          </div>
          <p className="text-sm text-muted-foreground">
            {customer?.name ?? "—"} • {t("issueDateLabel")} {invoice.issue_date}
            {invoice.due_date ? ` • ${t("dueDateLabel")} ${invoice.due_date}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={printPdf} disabled={isPreparingPrint}>
            {isPreparingPrint ? <Loader2Icon className="animate-spin" /> : <PrinterIcon />}
            {tPrint("printButton")}
          </Button>
          <Button variant="outline" onClick={downloadPdf} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
            {tPrint("downloadPdfButton")}
          </Button>
          {isDraft ? (
            <Button onClick={confirmInvoice} disabled={updateInvoice.isPending}>
              <CheckIcon />
              {t("confirmInvoice")}
            </Button>
          ) : null}
          {canRecordPayment ? (
            <Button variant="outline" onClick={() => setShowRecordPayment(true)}>
              <BanknoteIcon />
              {t("recordPayment")}
            </Button>
          ) : null}
          {canRecordPayment && !emiPlan && !isPaid ? (
            <Button variant="outline" onClick={() => setShowSetupEmi(true)}>
              <CalendarClockIcon />
              {tEmi("setupButton")}
            </Button>
          ) : null}
          {!isVoid ? (
            <Button variant="destructive" size="icon" onClick={() => setConfirmVoid(true)} title={t("voidInvoice")}>
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
          <InvoiceItemsSection invoiceId={id} warehouseId={invoice.warehouse_id} editable={isDraft} />
          {invoice.notes ? (
            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="mb-2 text-sm font-semibold">{t("notesLabel")}</h2>
              <p className="text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 text-sm font-semibold">{t("summaryTitle")}</h2>
            {isDraft ? (
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("offerLabel")}
                </label>
                <OfferSelect
                  value={invoice.offer_id}
                  onValueChange={(offerId) => {
                    updateInvoice.mutate(
                      { id, input: { offer_id: offerId } },
                      {
                        onSuccess: () => toast.success(tCommon("updatedSuccess")),
                        onError: () => toast.error(tCommon("genericError")),
                      },
                    )
                  }}
                  placeholder={t("offerPlaceholder")}
                />
              </div>
            ) : appliedOffer ? (
              <div className="mb-3 flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2 text-xs text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800/50">
                <span className="font-medium">{t("offerLabel")}</span>
                <span className="font-semibold">{appliedOffer.name}</span>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotalLabel")}</span>
                <span>{money(invoice.subtotal)}</span>
              </div>
              {invoice.discount_total > 0 ? (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="text-muted-foreground">{t("discountLabel")}</span>
                  <span>−{money(invoice.discount_total)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("taxLabel")}</span>
                <span>{money(invoice.tax_total)}</span>
              </div>
              <div className="my-1.5 border-t" />
              <div className="flex justify-between text-base font-semibold">
                <span>{t("totalLabel")}</span>
                <span>{money(invoice.total)}</span>
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                <span>{t("amountPaidLabel")}</span>
                <span>{money(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold">
                <span>{t("balanceDueLabel")}</span>
                <span>{money(balanceDue)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 text-sm font-semibold">{t("paymentsTitle")}</h2>
            {payments?.length ? (
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

          {emiPlan ? (
            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                <CalendarClockIcon className="size-4" />
                {tEmi("scheduleTitle")}
              </h2>
              <div className="flex flex-col gap-2">
                {(installments ?? []).map((installment) => {
                  const isOverdue = installment.status === "pending" && installment.due_date < new Date().toISOString().slice(0, 10)
                  return (
                    <div key={installment.id} className="flex items-center justify-between text-sm">
                      <div className="flex flex-col">
                        <span>{tEmi("installmentLabel", { number: installment.installment_number, total: emiPlan.months })}</span>
                        <span className="text-xs text-muted-foreground">{installment.due_date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{money(installment.amount)}</span>
                        {installment.status === "paid" ? (
                          <StatusBadge status="paid">{tEmi("statusPaid")}</StatusBadge>
                        ) : balanceDue <= 0 ? (
                          // The invoice is already fully paid (e.g. a
                          // payment was recorded some other way, from
                          // before Record Payment was restricted above)
                          // even though this installment row itself was
                          // never linked/marked paid. Showing "Pay" here
                          // would let the cashier collect the same money
                          // again, so show a neutral "covered" state
                          // instead of an actionable button.
                          <StatusBadge status="covered">{tEmi("statusCovered")}</StatusBadge>
                        ) : isOverdue ? (
                          <StatusBadge status="overdue">{tEmi("statusOverdue")}</StatusBadge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPayingInstallment(installment)
                              setShowRecordPayment(true)
                            }}
                          >
                            {tEmi("payButton")}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <MoreHorizontalIcon className="size-4" />
              {t("detailsTitle")}
            </h2>
            <div className="flex flex-col gap-2 text-xs">
              {isDraft ? (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{t("warehouseLabel")}</span>
                  <WarehouseSelect
                    value={invoice.warehouse_id}
                    onValueChange={(value) =>
                      updateInvoice.mutate(
                        { id, input: { warehouse_id: value } },
                        { onError: () => toast.error(tCommon("genericError")) },
                      )
                    }
                    placeholder={t("warehousePlaceholder")}
                    className="h-7 text-xs"
                  />
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("warehouseLabel")}</span>
                  <span>{warehouse?.name ?? "—"}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("currencyLabel")}</span>
                <span>{invoice.currency}</span>
              </div>
            </div>
          </div>

          {delivery ? (
            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                <TruckIcon className="size-4" />
                {tDelivery("title")}
              </h2>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="shrink-0 text-muted-foreground">{tDelivery("addressLabel")}</span>
                  <span className="text-right">
                    {(delivery.delivery_address as { full_address?: string } | null)?.full_address || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tDelivery("personLabel")}</span>
                  <span>
                    {deliveryPerson?.name ?? tDelivery("notAssigned")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tDelivery("paymentModeLabel")}</span>
                  <span>{delivery.payment_mode ? tDeliveryPaymentMode(delivery.payment_mode) : "—"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{tDelivery("statusLabel")}</span>
                  <Select
                    value={delivery.status}
                    onValueChange={(value) =>
                      updateDelivery.mutate({
                        id: delivery.id,
                        input: {
                          status: value as typeof delivery.status,
                          delivered_at: value === "delivered" ? new Date().toISOString() : delivery.delivered_at,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="h-7 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{tDeliveryStatus("pending")}</SelectItem>
                      <SelectItem value="out_for_delivery">{tDeliveryStatus("out_for_delivery")}</SelectItem>
                      <SelectItem value="delivered">{tDeliveryStatus("delivered")}</SelectItem>
                      <SelectItem value="failed">{tDeliveryStatus("failed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <RecordPaymentDialog
        open={showRecordPayment}
        onOpenChange={(open) => {
          setShowRecordPayment(open)
          if (!open) setPayingInstallment(null)
        }}
        methods={PAYMENT_METHODS}
        balanceDue={payingInstallment ? payingInstallment.amount : balanceDue}
        isSubmitting={createPayment.isPending}
        onSubmit={(values) =>
          createPayment.mutate(
            {
              invoice_id: id,
              amount: values.amount,
              method: values.method as Payment["method"],
              reference: values.reference || null,
              notes: values.notes || null,
              paid_at: values.paid_at,
              installment_id: payingInstallment?.id ?? null,
            },
            {
              onSuccess: () => {
                toast.success(tCommon("createdSuccess"))
                setShowRecordPayment(false)
                setPayingInstallment(null)
              },
              onError: () => toast.error(tCommon("genericError")),
            },
          )
        }
      />

      <SetupEmiDialog
        open={showSetupEmi}
        onOpenChange={setShowSetupEmi}
        totalAmount={invoice.total}
        isSubmitting={createInstallmentPlan.isPending || createInstallment.isPending}
        onSubmit={setupEmi}
      />

      <DeleteConfirmDialog
        open={confirmVoid}
        onOpenChange={setConfirmVoid}
        isDeleting={updateInvoice.isPending}
        title={t("voidConfirmTitle")}
        description={t("voidConfirmDescription")}
        onConfirm={voidInvoice}
      />
    </div>
  )
}
