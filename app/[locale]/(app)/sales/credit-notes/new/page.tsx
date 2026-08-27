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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useCustomers } from "@/hooks/use-customers"
import { useCreateCreditNote } from "@/hooks/use-credit-notes"
import { useInvoices } from "@/hooks/use-invoices"
import { routes } from "@/lib/routes"

const newCreditNoteSchema = z.object({
  invoice_id: z.string().min(1),
  reason: z.string().optional(),
  issue_date: z.string().min(1),
})
type NewCreditNoteValues = z.infer<typeof newCreditNoteSchema>

export default function NewCreditNotePage() {
  const t = useTranslations("CreditNotes")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createCreditNote = useCreateCreditNote()
  const { data: invoices } = useInvoices()
  const { data: customers } = useCustomers()

  const returnableInvoices = invoices?.filter((inv) => inv.status !== "draft" && inv.status !== "void") ?? []

  const form = useForm<NewCreditNoteValues>({
    resolver: zodResolver(newCreditNoteSchema),
    defaultValues: { issue_date: new Date().toISOString().slice(0, 10) },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const selectedInvoiceId = useWatch({ control, name: "invoice_id" })
  const issueDate = useWatch({ control, name: "issue_date" })
  const selectedInvoice = invoices?.find((inv) => inv.id === selectedInvoiceId)
  const customerName = selectedInvoice ? customers?.find((c) => c.id === selectedInvoice.customer_id)?.name : undefined

  const steps: StepperStep[] = [
    { label: t("stepCreditNoteDetails"), done: false, current: true },
    { label: t("stepAddItems"), done: false, current: false },
  ]

  function onSubmit(values: NewCreditNoteValues) {
    const invoice = invoices?.find((inv) => inv.id === values.invoice_id)
    if (!invoice) return

    createCreditNote.mutate(
      {
        invoice_id: values.invoice_id,
        customer_id: invoice.customer_id,
        warehouse_id: invoice.warehouse_id,
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
        <Field data-invalid={!!formState.errors.invoice_id}>
          <FieldLabel htmlFor="cn-invoice">{t("invoiceLabel")}</FieldLabel>
          <SearchableSelect
            id="cn-invoice"
            value={selectedInvoiceId}
            onValueChange={(value) => setValue("invoice_id", value, { shouldValidate: true })}
            placeholder={t("invoicePlaceholder")}
            options={returnableInvoices.map((invoice) => {
              const customer = customers?.find((c) => c.id === invoice.customer_id)
              return {
                value: invoice.id,
                label: invoice.invoice_number,
                subtitle: customer?.name ?? undefined,
                keywords: [customer?.name ?? ""],
              }
            })}
          />
          {formState.errors.invoice_id ? <FieldError>{tCommon("required")}</FieldError> : null}
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
