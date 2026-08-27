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
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { VendorSelect } from "@/components/vendor-select"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useCreatePurchaseBill } from "@/hooks/use-purchase-bills"
import { WarehouseSelect } from "@/components/warehouse-select"
import { routes } from "@/lib/routes"

const newBillSchema = z.object({
  vendor_id: z.string().min(1),
  warehouse_id: z.string().optional(),
  vendor_invoice_number: z.string().optional(),
  bill_date: z.string().min(1),
  due_date: z.string().optional(),
  notes: z.string().optional(),
})
type NewBillValues = z.infer<typeof newBillSchema>

export default function NewPurchaseBillPage() {
  const t = useTranslations("PurchaseBills")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createBill = useCreatePurchaseBill()

  const form = useForm<NewBillValues>({
    resolver: zodResolver(newBillSchema),
    defaultValues: { bill_date: new Date().toISOString().slice(0, 10) },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const vendorId = useWatch({ control, name: "vendor_id" })
  const warehouseId = useWatch({ control, name: "warehouse_id" })
  const billDate = useWatch({ control, name: "bill_date" })
  const dueDate = useWatch({ control, name: "due_date" })

  const steps: StepperStep[] = [
    { label: t("stepBillDetails"), done: false, current: true },
    { label: t("stepAddItems"), done: false, current: false },
  ]

  function onSubmit(values: NewBillValues) {
    createBill.mutate(
      {
        vendor_id: values.vendor_id,
        warehouse_id: values.warehouse_id || null,
        vendor_invoice_number: values.vendor_invoice_number || null,
        bill_date: values.bill_date,
        due_date: values.due_date || null,
        notes: values.notes || null,
      },
      {
        onSuccess: (bill) => {
          toast.success(tCommon("createdSuccess"))
          router.push(routes.purchases.bills.detail(bill.id))
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
      <h1 className="mb-4 text-2xl font-semibold">{t("newBill")}</h1>

      <div className="mb-4">
        <DocumentStepper steps={steps} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!formState.errors.vendor_id}>
            <FieldLabel htmlFor="pb-vendor">{t("vendorLabel")}</FieldLabel>
            <VendorSelect
              id="pb-vendor"
              value={vendorId}
              onValueChange={(value) => setValue("vendor_id", value, { shouldValidate: true })}
              placeholder={t("vendorPlaceholder")}
            />
            {formState.errors.vendor_id ? <FieldError>{tCommon("required")}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="pb-warehouse">{t("warehouseLabel")}</FieldLabel>
            <WarehouseSelect
              id="pb-warehouse"
              value={warehouseId}
              onValueChange={(value) => setValue("warehouse_id", value)}
              placeholder={t("warehousePlaceholder")}
              clearable
              onClear={() => setValue("warehouse_id", undefined)}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="pb-vendor-ref">{t("vendorInvoiceNumberLabel")}</FieldLabel>
          <Input id="pb-vendor-ref" {...register("vendor_invoice_number")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="pb-bill-date">{t("billDateLabel")}</FieldLabel>
            <DatePicker
              id="pb-bill-date"
              value={billDate}
              onChange={(value) => setValue("bill_date", value, { shouldValidate: true })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pb-due-date">{t("dueDateLabel")}</FieldLabel>
            <DatePicker
              id="pb-due-date"
              value={dueDate}
              onChange={(value) => setValue("due_date", value, { shouldValidate: true })}
              clearable
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="pb-notes">{t("notesLabel")}</FieldLabel>
          <Textarea id="pb-notes" {...register("notes")} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={createBill.isPending}>
            {createBill.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {t("continueToItems")}
          </Button>
        </div>
      </form>
    </div>
  )
}
