"use client"

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
import { useCustomers } from "@/hooks/use-customers"
import { useCreateCreditNote } from "@/hooks/use-credit-notes"
import { useInvoices } from "@/hooks/use-invoices"
import { routes } from "@/lib/routes"

const newCreditNoteSchema = z.object({
  customer_id: z.string().min(1),
  invoice_id: z.string().optional(),
  reason: z.string().optional(),
  issue_date: z.string().min(1),
})
type NewCreditNoteValues = z.infer<typeof newCreditNoteSchema>

const NO_INVOICE = "__none__"

export default function NewCreditNotePage() {
  const t = useTranslations("CreditNotes")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createCreditNote = useCreateCreditNote()
  const { data: invoices } = useInvoices()
  const { data: customers } = useCustomers()

  const form = useForm<NewCreditNoteValues>({
    resolver: zodResolver(newCreditNoteSchema),
    defaultValues: { issue_date: new Date().toISOString().slice(0, 10) },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const selectedCustomerId = useWatch({ control, name: "customer_id" })
  const selectedInvoiceId = useWatch({ control, name: "invoice_id" })
  const issueDate = useWatch({ control, name: "issue_date" })

  const relatedInvoices =
    invoices?.filter(
      (inv) => inv.status !== "draft" && inv.status !== "void" && (!selectedCustomerId || inv.customer_id === selectedCustomerId),
    ) ?? []

  const steps: StepperStep[] = [
    { label: t("stepCreditNoteDetails"), done: false, current: true },
    { label: t("stepAddItems"), done: false, current: false },
  ]

  function onSubmit(values: NewCreditNoteValues) {
    createCreditNote.mutate(
      {
        customer_id: values.customer_id,
        invoice_id: values.invoice_id && values.invoice_id !== NO_INVOICE ? values.invoice_id : null,
        reason: values.reason || null,
        issue_date: values.issue_date,
      },
      {
        onSuccess: (creditNote) => {
          toast.success(tCommon("createdSuccess"))
          router.push(routes.sales.creditNotes.detail(creditNote.id))
        },
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Link href={routes.sales.creditNotes.list} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">{t("newCreditNote")}</h1>

      <div className="mb-4">
        <DocumentStepper steps={steps} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Field data-invalid={!!formState.errors.customer_id}>
          <FieldLabel htmlFor="cn-customer">{t("customerLabel")}</FieldLabel>
          <SearchableSelect
            id="cn-customer"
            value={selectedCustomerId}
            onValueChange={(value) => setValue("customer_id", value, { shouldValidate: true })}
            placeholder={t("customerPlaceholder")}
            options={
              customers?.map((customer) => ({
                value: customer.id,
                label: customer.name,
              })) ?? []
            }
          />
          {formState.errors.customer_id ? <FieldError>{tCommon("required")}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="cn-invoice">{t("invoiceLabel")}</FieldLabel>
          <SearchableSelect
            id="cn-invoice"
            value={selectedInvoiceId ?? NO_INVOICE}
            onValueChange={(value) => setValue("invoice_id", value === NO_INVOICE ? undefined : value)}
            placeholder={t("invoicePlaceholder")}
            options={[
              { value: NO_INVOICE, label: t("noInvoiceOption") },
              ...relatedInvoices.map((invoice) => ({
                value: invoice.id,
                label: invoice.invoice_number,
              })),
            ]}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cn-issue-date">{t("issueDateLabel")}</FieldLabel>
          <DatePicker
            id="cn-issue-date"
            value={issueDate}
            onChange={(value) => setValue("issue_date", value, { shouldValidate: true })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cn-reason">{t("reasonLabel")}</FieldLabel>
          <Textarea id="cn-reason" placeholder={t("reasonPlaceholder")} {...register("reason")} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={createCreditNote.isPending}>
            {createCreditNote.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {t("continueToItems")}
          </Button>
        </div>
      </form>
    </div>
  )
}
