"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Offer } from "@/lib/database/types"

export const offerFormSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  discount_type: z.enum(["percentage", "flat"]),
  value: z.number().min(0),
  applies_to_all_items: z.boolean(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  is_active: z.boolean(),
})

export type OfferFormValues = z.infer<typeof offerFormSchema>

export function offerToFormValues(offer?: Offer): OfferFormValues {
  return {
    name: offer?.name ?? "",
    description: offer?.description ?? "",
    discount_type: offer?.discount_type ?? "percentage",
    value: offer?.value ?? 0,
    applies_to_all_items: offer?.applies_to_all_items ?? true,
    starts_at: offer?.starts_at ?? "",
    ends_at: offer?.ends_at ?? "",
    is_active: offer?.is_active ?? true,
  }
}

export function formValuesToOfferInput(values: OfferFormValues) {
  return {
    name: values.name,
    description: values.description || null,
    discount_type: values.discount_type,
    value: values.value,
    applies_to_all_items: values.applies_to_all_items,
    starts_at: values.starts_at || null,
    ends_at: values.ends_at || null,
    is_active: values.is_active,
  }
}

export function OfferForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel,
  itemPicker,
}: {
  defaultValues?: OfferFormValues
  onSubmit: (values: OfferFormValues) => void
  isSubmitting?: boolean
  submitLabel: string
  /** Rendered under the scope section when applies_to_all_items is off — only
   * meaningful once the offer exists (see the New page's note). */
  itemPicker?: React.ReactNode
}) {
  const t = useTranslations("Offers")

  const form = useForm<OfferFormValues>({
    resolver: zodResolver(offerFormSchema),
    values: defaultValues ?? offerToFormValues(),
  })
  const { register, handleSubmit, control, setValue } = form
  const discountType = useWatch({ control, name: "discount_type" })
  const appliesToAll = useWatch({ control, name: "applies_to_all_items" })
  const isActive = useWatch({ control, name: "is_active" })
  const startsAt = useWatch({ control, name: "starts_at" })
  const endsAt = useWatch({ control, name: "ends_at" })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("detailsTitle")}</h2>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="offer-name">{t("nameLabel")}</FieldLabel>
              <Input id="offer-name" {...register("name")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="offer-description">{t("descriptionLabel")}</FieldLabel>
              <Input id="offer-description" {...register("description")} />
            </Field>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("discountTitle")}</h2>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <Field>
            <FieldLabel>{t("discountTypeLabel")}</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              value={discountType}
              onValueChange={(value) => value && setValue("discount_type", value as "percentage" | "flat")}
              className="justify-start"
            >
              <ToggleGroupItem value="percentage">{t("percentage")}</ToggleGroupItem>
              <ToggleGroupItem value="flat">{t("flatAmount")}</ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <Field className="max-w-xs">
            <FieldLabel htmlFor="offer-value">
              {discountType === "percentage" ? t("valuePercentLabel") : t("valueFlatLabel")}
            </FieldLabel>
            <Input id="offer-value" type="number" step="0.01" min={0} {...register("value", { valueAsNumber: true })} />
          </Field>
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("scopeTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("scopeDescription")}</p>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <Field orientation="horizontal">
            <FieldLabel htmlFor="offer-applies-all">{t("appliesToAllLabel")}</FieldLabel>
            <Switch
              id="offer-applies-all"
              checked={appliesToAll}
              onCheckedChange={(checked) => setValue("applies_to_all_items", checked)}
            />
          </Field>
          {!appliesToAll ? itemPicker : null}
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="offer-starts">{t("startsOnLabel")}</FieldLabel>
              <DatePicker
                id="offer-starts"
                value={startsAt}
                onChange={(value) => setValue("starts_at", value, { shouldValidate: true })}
                clearable
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="offer-ends">{t("endsOnLabel")}</FieldLabel>
              <DatePicker
                id="offer-ends"
                value={endsAt}
                onChange={(value) => setValue("ends_at", value, { shouldValidate: true })}
                clearable
              />
            </Field>
          </div>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="offer-active">
              {t("activeLabel")}
              <span className="block text-xs font-normal text-muted-foreground">{t("activeHint")}</span>
            </FieldLabel>
            <Switch id="offer-active" checked={isActive} onCheckedChange={(checked) => setValue("is_active", checked)} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
