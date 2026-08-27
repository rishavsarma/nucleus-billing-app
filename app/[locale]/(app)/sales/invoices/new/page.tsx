"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"
import { z } from "zod"

import { Link, useRouter } from "@/i18n/navigation"
import { CustomerSelect } from "@/components/customer-select"
import { DocumentStepper, type StepperStep } from "@/components/document-stepper"
import { OfferSelect } from "@/components/offer-select"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCustomers } from "@/hooks/use-customers"
import { useCreateInvoice } from "@/hooks/use-invoices"
import { useOffers } from "@/hooks/use-offers"
import { useWarehouses } from "@/hooks/use-warehouses"
import { routes } from "@/lib/routes"

const NONE = "__none__"

const newInvoiceSchema = z.object({
  customer_id: z.string().min(1),
  warehouse_id: z.string().optional(),
  offer_id: z.string().optional(),
  issue_date: z.string().min(1),
  due_date: z.string().optional(),
  notes: z.string().optional(),
})
type NewInvoiceValues = z.infer<typeof newInvoiceSchema>

export default function NewInvoicePage() {
  const t = useTranslations("Invoices")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createInvoice = useCreateInvoice()
  const { data: customers } = useCustomers()
  const { data: warehouses } = useWarehouses()
  const { data: offers } = useOffers()

  const form = useForm<NewInvoiceValues>({
    resolver: zodResolver(newInvoiceSchema),
    defaultValues: { issue_date: new Date().toISOString().slice(0, 10) },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const customerId = useWatch({ control, name: "customer_id" })
  const warehouseId = useWatch({ control, name: "warehouse_id" })
  const offerId = useWatch({ control, name: "offer_id" })
  const issueDate = useWatch({ control, name: "issue_date" })
  const dueDate = useWatch({ control, name: "due_date" })

  const steps: StepperStep[] = [
    { label: t("stepInvoiceDetails"), done: false, current: true },
    { label: t("stepAddItems"), done: false, current: false },
  ]

  function onSubmit(values: NewInvoiceValues) {
    createInvoice.mutate(
      {
        customer_id: values.customer_id,
        warehouse_id: values.warehouse_id || null,
        offer_id: values.offer_id || null,
        issue_date: values.issue_date,
        due_date: values.due_date || null,
        notes: values.notes || null,
      },
      {
        onSuccess: (invoice) => {
          toast.success(tCommon("createdSuccess"))
          router.push(routes.sales.invoices.detail(invoice.id))
        },
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Link href={routes.sales.invoices.list} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">{t("newInvoice")}</h1>

      <div className="mb-4">
        <DocumentStepper steps={steps} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!formState.errors.customer_id}>
            <FieldLabel htmlFor="inv-customer">{t("customerLabel")}</FieldLabel>
            <CustomerSelect
              id="inv-customer"
              customers={customers}
              value={customerId}
              onValueChange={(value) => setValue("customer_id", value, { shouldValidate: true })}
              placeholder={t("customerPlaceholder")}
            />
            {formState.errors.customer_id ? <FieldError>{tCommon("required")}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="inv-warehouse">{t("warehouseLabel")}</FieldLabel>
            <Select value={warehouseId ?? NONE} onValueChange={(value) => setValue("warehouse_id", value === NONE ? undefined : value)}>
              <SelectTrigger id="inv-warehouse" className="w-full">
                <SelectValue placeholder={t("warehousePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("warehousePlaceholder")}</SelectItem>
                {warehouses?.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="inv-offer">{t("offerLabel")}</FieldLabel>
            <OfferSelect
              id="inv-offer"
              offers={offers}
              value={offerId}
              onValueChange={(value) => setValue("offer_id", value ?? undefined)}
              placeholder={t("offerPlaceholder")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="inv-issue-date">{t("issueDateLabel")}</FieldLabel>
            <DatePicker
              id="inv-issue-date"
              value={issueDate}
              onChange={(value) => setValue("issue_date", value, { shouldValidate: true })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="inv-due-date">{t("dueDateLabel")}</FieldLabel>
            <DatePicker
              id="inv-due-date"
              value={dueDate}
              onChange={(value) => setValue("due_date", value, { shouldValidate: true })}
              clearable
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="inv-notes">{t("notesLabel")}</FieldLabel>
          <Textarea id="inv-notes" {...register("notes")} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={createInvoice.isPending}>
            {createInvoice.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {t("continueToItems")}
          </Button>
        </div>
      </form>
    </div>
  )
}
