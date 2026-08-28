"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { z } from "zod"

import { EntityFormDialog } from "@/components/entity-form-dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const paymentFormSchema = z.object({
  amount: z.number().min(0.01),
  method: z.string().min(1),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paid_at: z.string().min(1),
})
type PaymentFormValues = z.infer<typeof paymentFormSchema>

export function RecordPaymentDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  methods,
  balanceDue,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: PaymentFormValues) => void
  isSubmitting?: boolean
  /** Method enum values valid for this document (payments vs purchase_payments differ). */
  methods: string[]
  balanceDue?: number
}) {
  const t = useTranslations("RecordPayment")
  const tMethods = useTranslations("PaymentMethods")

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    values: {
      amount: balanceDue ?? 0,
      method: methods[0] ?? "manual",
      reference: "",
      notes: "",
      paid_at: new Date().toISOString().slice(0, 10),
    },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const method = useWatch({ control, name: "method" })
  const paidAt = useWatch({ control, name: "paid_at" })

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      submitLabel={t("submit")}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Field data-invalid={!!formState.errors.amount}>
          <FieldLabel htmlFor="pay-amount">{t("amountLabel")}</FieldLabel>
          <Input id="pay-amount" type="number" step="0.01" min={0.01} {...register("amount", { valueAsNumber: true })} />
        </Field>
        <Field>
          <FieldLabel htmlFor="pay-method">{t("methodLabel")}</FieldLabel>
          <Select value={method} onValueChange={(value) => setValue("method", value)}>
            <SelectTrigger id="pay-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {methods.map((method) => (
                <SelectItem key={method} value={method}>
                  {tMethods(method)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="pay-date">{t("paidAtLabel")}</FieldLabel>
        <DatePicker
          id="pay-date"
          value={paidAt}
          onChange={(value) => setValue("paid_at", value, { shouldValidate: true })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="pay-reference">{t("referenceLabel")}</FieldLabel>
        <Input id="pay-reference" placeholder={t("referencePlaceholder")} {...register("reference")} />
      </Field>
      <Field>
        <FieldLabel htmlFor="pay-notes">{t("notesLabel")}</FieldLabel>
        <Textarea id="pay-notes" {...register("notes")} />
      </Field>
      {balanceDue !== undefined ? (
        <p className="text-xs text-muted-foreground">
          {t("balanceDueNote", { amount: "₹" + balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 }) })}
        </p>
      ) : null}
    </EntityFormDialog>
  )
}
