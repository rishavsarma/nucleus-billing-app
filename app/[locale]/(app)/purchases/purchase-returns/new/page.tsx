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
import { useVendors } from "@/hooks/use-vendors"
import { useCreatePurchaseReturn } from "@/hooks/use-purchase-returns"
import { usePurchaseBills } from "@/hooks/use-purchase-bills"
import { routes } from "@/lib/routes"

const newPurchaseReturnSchema = z.object({
  purchase_bill_id: z.string().min(1),
  reason: z.string().optional(),
  issue_date: z.string().min(1),
})
type NewPurchaseReturnValues = z.infer<typeof newPurchaseReturnSchema>

export default function NewPurchaseReturnPage() {
  const t = useTranslations("PurchaseReturns")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createPurchaseReturn = useCreatePurchaseReturn()
  const { data: bills } = usePurchaseBills()
  const { data: vendors } = useVendors()

  const returnableBills = bills?.filter((b) => b.status !== "draft" && b.status !== "void") ?? []

  const form = useForm<NewPurchaseReturnValues>({
    resolver: zodResolver(newPurchaseReturnSchema),
    defaultValues: { issue_date: new Date().toISOString().slice(0, 10) },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const selectedBillId = useWatch({ control, name: "purchase_bill_id" })
  const issueDate = useWatch({ control, name: "issue_date" })

  const steps: StepperStep[] = [
    { label: t("stepPurchaseReturnDetails"), done: false, current: true },
    { label: t("stepAddItems"), done: false, current: false },
  ]

  function onSubmit(values: NewPurchaseReturnValues) {
    const bill = bills?.find((b) => b.id === values.purchase_bill_id)
    if (!bill) return

    createPurchaseReturn.mutate(
      {
        purchase_bill_id: values.purchase_bill_id,
        vendor_id: bill.vendor_id,
        warehouse_id: bill.warehouse_id,
        reason: values.reason || null,
        issue_date: values.issue_date,
      },
      {
        onSuccess: (purchaseReturn) => {
          toast.success(tCommon("createdSuccess"))
          router.push(routes.purchases.purchaseReturns.detail(purchaseReturn.id))
        },
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Link href={routes.purchases.purchaseReturns.list} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">{t("newPurchaseReturn")}</h1>

      <div className="mb-4">
        <DocumentStepper steps={steps} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Field data-invalid={!!formState.errors.purchase_bill_id}>
          <FieldLabel htmlFor="pr-bill">{t("billLabel")}</FieldLabel>
          <SearchableSelect
            id="pr-bill"
            value={selectedBillId}
            onValueChange={(value) => setValue("purchase_bill_id", value, { shouldValidate: true })}
            placeholder={t("billPlaceholder")}
            options={returnableBills.map((bill) => {
              const vendor = vendors?.find((v) => v.id === bill.vendor_id)
              return {
                value: bill.id,
                label: bill.bill_number,
                subtitle: vendor?.name ?? undefined,
                keywords: [vendor?.name ?? ""],
              }
            })}
          />
          {formState.errors.purchase_bill_id ? <FieldError>{tCommon("required")}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="pr-issue-date">{t("issueDateLabel")}</FieldLabel>
          <DatePicker
            id="pr-issue-date"
            value={issueDate}
            onChange={(value) => setValue("issue_date", value, { shouldValidate: true })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pr-reason">{t("reasonLabel")}</FieldLabel>
          <Textarea id="pr-reason" placeholder={t("reasonPlaceholder")} {...register("reason")} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={createPurchaseReturn.isPending}>
            {createPurchaseReturn.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {t("continueToItems")}
          </Button>
        </div>
      </form>
    </div>
  )
}
