"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { z } from "zod"

import { EntityFormDialog } from "@/components/entity-form-dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const emiFormSchema = z.object({
  months: z.number().int().min(2).max(60),
  start_date: z.string().min(1),
})
export type EmiFormValues = z.infer<typeof emiFormSchema>

export function SetupEmiDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  totalAmount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: EmiFormValues) => void
  isSubmitting?: boolean
  totalAmount: number
}) {
  const t = useTranslations("Emi")

  const form = useForm<EmiFormValues>({
    resolver: zodResolver(emiFormSchema),
    values: { months: 3, start_date: new Date().toISOString().slice(0, 10) },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const months = useWatch({ control, name: "months" })
  const startDate = useWatch({ control, name: "start_date" })

  const perInstallment = months > 0 ? totalAmount / months : 0

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("setupTitle")}
      description={t("setupDescription")}
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      submitLabel={t("setupSubmit")}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={!!formState.errors.months}>
          <FieldLabel htmlFor="emi-months">{t("monthsLabel")}</FieldLabel>
          <Input id="emi-months" type="number" min={2} max={60} step={1} {...register("months", { valueAsNumber: true })} />
        </Field>
        <Field>
          <FieldLabel htmlFor="emi-start">{t("startDateLabel")}</FieldLabel>
          <DatePicker
            id="emi-start"
            value={startDate}
            onChange={(value) => setValue("start_date", value, { shouldValidate: true })}
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("previewNote", {
          months,
          amount: "₹" + perInstallment.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        })}
      </p>
    </EntityFormDialog>
  )
}
