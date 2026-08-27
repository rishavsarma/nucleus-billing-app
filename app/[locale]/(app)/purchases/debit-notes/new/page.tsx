"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"
import { z } from "zod"

import { useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { DocumentStepper, type StepperStep } from "@/components/document-stepper"
import { SearchableSelect } from "@/components/searchable-select"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useVendor, useVendorsList } from "@/hooks/use-vendors"
import { useCreateDebitNote } from "@/hooks/use-debit-notes"
import { usePurchaseBill, usePurchaseBillsList } from "@/hooks/use-purchase-bills"
import { routes } from "@/lib/routes"

const newDebitNoteSchema = z.object({
  vendor_id: z.string().min(1),
  purchase_bill_id: z.string().optional(),
  reason: z.string().optional(),
  issue_date: z.string().min(1),
})
type NewDebitNoteValues = z.infer<typeof newDebitNoteSchema>

const NO_BILL = "__none__"

export default function NewDebitNotePage() {
  const t = useTranslations("DebitNotes")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createDebitNote = useCreateDebitNote()

  const form = useForm<NewDebitNoteValues>({
    resolver: zodResolver(newDebitNoteSchema),
    defaultValues: { issue_date: new Date().toISOString().slice(0, 10) },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const selectedVendorId = useWatch({ control, name: "vendor_id" })
  const selectedBillId = useWatch({ control, name: "purchase_bill_id" })
  const issueDate = useWatch({ control, name: "issue_date" })

  // Both pickers below search the server instead of fetching every vendor
  // / every purchase bill in the org (pageSize: 9999 each) and filtering
  // client-side.
  const [vendorSearch, setVendorSearch] = useState("")
  const debouncedVendorSearch = useDebouncedValue(vendorSearch, 300)
  const { data: vendorsResult, isFetching: isFetchingVendors } = useVendorsList({
    search: debouncedVendorSearch,
    page: 1,
    pageSize: 20,
  })
  const { data: selectedVendor } = useVendor(selectedVendorId || undefined)
  const vendorOptions = [
    ...(selectedVendor && !vendorsResult?.data.some((v) => v.id === selectedVendor.id)
      ? [{ value: selectedVendor.id, label: selectedVendor.name }]
      : []),
    ...(vendorsResult?.data ?? []).map((vendor) => ({ value: vendor.id, label: vendor.name })),
  ]

  const [billSearch, setBillSearch] = useState("")
  const debouncedBillSearch = useDebouncedValue(billSearch, 300)
  const { data: billsResult, isFetching: isFetchingBills } = usePurchaseBillsList(
    { search: debouncedBillSearch, page: 1, pageSize: 20, vendor_id: selectedVendorId || undefined },
    !!selectedVendorId,
  )
  const { data: selectedBill } = usePurchaseBill(
    selectedBillId && selectedBillId !== NO_BILL ? selectedBillId : undefined,
  )
  const relatedBills = (billsResult?.data ?? []).filter((b) => b.status !== "draft" && b.status !== "void")
  const billOptions = [
    { value: NO_BILL, label: t("noBillOption") },
    ...(selectedBill && !relatedBills.some((b) => b.id === selectedBill.id)
      ? [{ value: selectedBill.id, label: selectedBill.bill_number }]
      : []),
    ...relatedBills.map((bill) => ({ value: bill.id, label: bill.bill_number })),
  ]

  const steps: StepperStep[] = [
    { label: t("stepDebitNoteDetails"), done: false, current: true },
    { label: t("stepAddItems"), done: false, current: false },
  ]

  function onSubmit(values: NewDebitNoteValues) {
    createDebitNote.mutate(
      {
        vendor_id: values.vendor_id,
        purchase_bill_id: values.purchase_bill_id && values.purchase_bill_id !== NO_BILL ? values.purchase_bill_id : null,
        reason: values.reason || null,
        issue_date: values.issue_date,
      },
      {
        onSuccess: (debitNote) => {
          toast.success(tCommon("createdSuccess"))
          router.push(routes.purchases.debitNotes.detail(debitNote.id))
        },
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Link href={routes.purchases.debitNotes.list} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">{t("newDebitNote")}</h1>

      <div className="mb-4">
        <DocumentStepper steps={steps} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Field data-invalid={!!formState.errors.vendor_id}>
          <FieldLabel htmlFor="dn-vendor">{t("vendorLabel")}</FieldLabel>
          <SearchableSelect
            id="dn-vendor"
            value={selectedVendorId}
            onValueChange={(value) => {
              setValue("vendor_id", value, { shouldValidate: true })
              setValue("purchase_bill_id", undefined)
            }}
            placeholder={t("vendorPlaceholder")}
            options={vendorOptions}
            search={vendorSearch}
            onSearchChange={setVendorSearch}
            isLoading={isFetchingVendors}
          />
          {formState.errors.vendor_id ? <FieldError>{tCommon("required")}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="dn-bill">{t("billLabel")}</FieldLabel>
          <SearchableSelect
            id="dn-bill"
            value={selectedBillId ?? NO_BILL}
            onValueChange={(value) => setValue("purchase_bill_id", value === NO_BILL ? undefined : value)}
            placeholder={t("billPlaceholder")}
            disabled={!selectedVendorId}
            options={billOptions}
            search={billSearch}
            onSearchChange={setBillSearch}
            isLoading={isFetchingBills}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dn-issue-date">{t("issueDateLabel")}</FieldLabel>
          <DatePicker
            id="dn-issue-date"
            value={issueDate}
            onChange={(value) => setValue("issue_date", value, { shouldValidate: true })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dn-reason">{t("reasonLabel")}</FieldLabel>
          <Textarea id="dn-reason" placeholder={t("reasonPlaceholder")} {...register("reason")} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={createDebitNote.isPending}>
            {createDebitNote.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {t("continueToItems")}
          </Button>
        </div>
      </form>
    </div>
  )
}
