"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"
import { z } from "zod"

import { Link, useRouter } from "@/i18n/navigation"
import { DocumentStepper, type StepperStep } from "@/components/document-stepper"
import { SearchableSelect } from "@/components/searchable-select"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useCreateSalesReturn } from "@/hooks/use-sales-returns"
import { useInvoice, useInvoicesList } from "@/hooks/use-invoices"
import { fetchInvoiceById } from "@/lib/database/services/invoices"
import { routes } from "@/lib/routes"

const newSalesReturnSchema = z.object({
  invoice_id: z.string().min(1),
  reason: z.string().optional(),
  issue_date: z.string().min(1),
})
type NewSalesReturnValues = z.infer<typeof newSalesReturnSchema>

export default function NewSalesReturnPage() {
  const t = useTranslations("SalesReturns")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createSalesReturn = useCreateSalesReturn()

  const form = useForm<NewSalesReturnValues>({
    resolver: zodResolver(newSalesReturnSchema),
    defaultValues: { issue_date: new Date().toISOString().slice(0, 10) },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const selectedInvoiceId = useWatch({ control, name: "invoice_id" })
  const issueDate = useWatch({ control, name: "issue_date" })

  // Server-searched instead of fetching every invoice and every customer
  // (pageSize: 9999 each) to build this dropdown — the paginated endpoint
  // already embeds the customer name via a join.
  const [invoiceSearch, setInvoiceSearch] = useState("")
  const debouncedInvoiceSearch = useDebouncedValue(invoiceSearch, 300)
  const { data: invoicesResult, isFetching: isFetchingInvoices } = useInvoicesList({
    search: debouncedInvoiceSearch,
    page: 1,
    pageSize: 20,
  })
  const returnableInvoices = (invoicesResult?.data ?? []).filter(
    (inv) => inv.status !== "draft" && inv.status !== "void",
  )
  // Keeps the trigger button showing the right invoice number even once
  // the dropdown closes and the search resets — the selection might no
  // longer be part of the current (empty-search) page.
  const { data: selectedInvoice } = useInvoice(selectedInvoiceId || undefined)
  const invoiceOptions = [
    ...(selectedInvoice && !returnableInvoices.some((inv) => inv.id === selectedInvoice.id)
      ? [{ value: selectedInvoice.id, label: selectedInvoice.invoice_number }]
      : []),
    ...returnableInvoices.map((invoice) => ({
      value: invoice.id,
      label: invoice.invoice_number,
      subtitle: invoice.customer?.name ?? undefined,
      keywords: [invoice.customer?.name ?? ""],
    })),
  ]

  const steps: StepperStep[] = [
    { label: t("stepSalesReturnDetails"), done: false, current: true },
    { label: t("stepAddItems"), done: false, current: false },
  ]

  async function onSubmit(values: NewSalesReturnValues) {
    // selectedInvoice tracks the same id as values.invoice_id (both derive
    // from the same form field), but re-fetch directly in case it hasn't
    // settled yet — this only ever resolves the one selected invoice, not
    // the whole list.
    const invoice = selectedInvoice?.id === values.invoice_id ? selectedInvoice : await fetchInvoiceById(values.invoice_id)
    if (!invoice) return

    createSalesReturn.mutate(
      {
        invoice_id: values.invoice_id,
        customer_id: invoice.customer_id,
        warehouse_id: invoice.warehouse_id,
        reason: values.reason || null,
        issue_date: values.issue_date,
      },
      {
        onSuccess: (salesReturn) => {
          toast.success(tCommon("createdSuccess"))
          router.push(routes.sales.salesReturns.detail(salesReturn.id))
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
      <h1 className="mb-4 text-2xl font-semibold">{t("newSalesReturn")}</h1>

      <div className="mb-4">
        <DocumentStepper steps={steps} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Field data-invalid={!!formState.errors.invoice_id}>
          <FieldLabel htmlFor="sr-invoice">{t("invoiceLabel")}</FieldLabel>
          <SearchableSelect
            id="sr-invoice"
            value={selectedInvoiceId}
            onValueChange={(value) => setValue("invoice_id", value, { shouldValidate: true })}
            placeholder={t("invoicePlaceholder")}
            options={invoiceOptions}
            search={invoiceSearch}
            onSearchChange={setInvoiceSearch}
            isLoading={isFetchingInvoices}
          />
          {formState.errors.invoice_id ? <FieldError>{tCommon("required")}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="sr-issue-date">{t("issueDateLabel")}</FieldLabel>
          <DatePicker
            id="sr-issue-date"
            value={issueDate}
            onChange={(value) => setValue("issue_date", value, { shouldValidate: true })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sr-reason">{t("reasonLabel")}</FieldLabel>
          <Textarea id="sr-reason" placeholder={t("reasonPlaceholder")} {...register("reason")} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={createSalesReturn.isPending}>
            {createSalesReturn.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {t("continueToItems")}
          </Button>
        </div>
      </form>
    </div>
  )
}
