"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useTaxRates } from "@/hooks/use-tax-rates"
import type { Item } from "@/lib/database/types"

export const itemFormSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  description: z.string().optional(),
  hsn_sac_code: z.string().optional(),
  unit: z.string().min(1),
  tax_rate_id: z.string().optional(),
  unit_price: z.number().min(0),
  purchase_price: z.number().min(0),
  track_inventory: z.boolean(),
  reorder_level: z.number().min(0),
  is_active: z.boolean(),
})

export type ItemFormValues = z.infer<typeof itemFormSchema>

export function itemToFormValues(item?: Item): ItemFormValues {
  return {
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    description: item?.description ?? "",
    hsn_sac_code: item?.hsn_sac_code ?? "",
    unit: item?.unit ?? "pcs",
    tax_rate_id: item?.tax_rate_id ?? undefined,
    unit_price: item?.unit_price ?? 0,
    purchase_price: item?.purchase_price ?? 0,
    track_inventory: item?.track_inventory ?? true,
    reorder_level: item?.reorder_level ?? 0,
    is_active: item?.is_active ?? true,
  }
}

export function formValuesToItemInput(values: ItemFormValues) {
  return {
    name: values.name,
    sku: values.sku || null,
    description: values.description || null,
    hsn_sac_code: values.hsn_sac_code || null,
    unit: values.unit,
    tax_rate_id: values.tax_rate_id || null,
    unit_price: values.unit_price,
    purchase_price: values.purchase_price,
    track_inventory: values.track_inventory,
    reorder_level: values.reorder_level,
    is_active: values.is_active,
  }
}

export function ItemForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel,
}: {
  defaultValues?: ItemFormValues
  onSubmit: (values: ItemFormValues) => void
  isSubmitting?: boolean
  submitLabel: string
}) {
  const t = useTranslations("Items")
  const { data: taxRates } = useTaxRates()

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    values: defaultValues ?? itemToFormValues(),
  })
  const { register, handleSubmit, control, formState, setValue } = form
  const trackInventory = useWatch({ control, name: "track_inventory" })
  const isActive = useWatch({ control, name: "is_active" })
  const taxRateId = useWatch({ control, name: "tax_rate_id" })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("basicDetailsTitle")}</h2>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <Field data-invalid={!!formState.errors.name}>
              <FieldLabel htmlFor="item-name">{t("nameLabel")}</FieldLabel>
              <Input id="item-name" {...register("name")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="item-sku">{t("skuLabel")}</FieldLabel>
              <Input id="item-sku" {...register("sku")} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="item-description">{t("descriptionLabel")}</FieldLabel>
            <Textarea id="item-description" {...register("description")} />
          </Field>
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("classificationTitle")}</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 p-4">
          <Field>
            <FieldLabel htmlFor="item-hsn">{t("hsnLabel")}</FieldLabel>
            <Input id="item-hsn" {...register("hsn_sac_code")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-unit">{t("unitLabel")}</FieldLabel>
            <Input id="item-unit" {...register("unit")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-tax-rate">{t("taxRateLabel")}</FieldLabel>
            <Select value={taxRateId} onValueChange={(value) => setValue("tax_rate_id", value)}>
              <SelectTrigger id="item-tax-rate" className="w-full">
                <SelectValue placeholder={t("taxRatePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {taxRates?.map((rate) => (
                  <SelectItem key={rate.id} value={rate.id}>
                    {rate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("pricingTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("pricingDescription")}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 p-4">
          <Field>
            <FieldLabel htmlFor="item-unit-price">{t("unitPriceLabel")}</FieldLabel>
            <Input id="item-unit-price" type="number" step="0.01" min={0} {...register("unit_price", { valueAsNumber: true })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-purchase-price">{t("purchasePriceLabel")}</FieldLabel>
            <Input id="item-purchase-price" type="number" step="0.01" min={0} {...register("purchase_price", { valueAsNumber: true })} />
          </Field>
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("inventoryTitle")}</h2>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <Field orientation="horizontal">
            <FieldLabel htmlFor="item-track-inventory">
              {t("trackInventoryLabel")}
              <span className="block text-xs font-normal text-muted-foreground">{t("trackInventoryHint")}</span>
            </FieldLabel>
            <Switch
              id="item-track-inventory"
              checked={trackInventory}
              onCheckedChange={(checked) => setValue("track_inventory", checked)}
            />
          </Field>
          {trackInventory ? (
            <Field className="max-w-xs">
              <FieldLabel htmlFor="item-reorder-level">{t("reorderLevelLabel")}</FieldLabel>
              <Input
                id="item-reorder-level"
                type="number"
                step="0.01"
                min={0}
                {...register("reorder_level", { valueAsNumber: true })}
              />
            </Field>
          ) : null}
          <Field orientation="horizontal">
            <FieldLabel htmlFor="item-active">
              {t("activeLabel")}
              <span className="block text-xs font-normal text-muted-foreground">{t("activeHint")}</span>
            </FieldLabel>
            <Switch id="item-active" checked={isActive} onCheckedChange={(checked) => setValue("is_active", checked)} />
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
