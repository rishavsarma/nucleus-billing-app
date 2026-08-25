"use client"

import { useQuery } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon, InfoIcon } from "lucide-react"
import { z } from "zod"

import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useItems } from "@/hooks/use-items"
import { fetchItemStock } from "@/lib/database/services/item-stock"
import { useCreateStockMovement } from "@/hooks/use-stock-movements"
import { useWarehouses } from "@/hooks/use-warehouses"
import { routes } from "@/lib/routes"

const adjustmentSchema = z.object({
  item_id: z.string().min(1),
  warehouse_id: z.string().min(1),
  quantity_delta: z.number().refine((n) => n !== 0, "required"),
  notes: z.string().optional(),
})
type AdjustmentValues = z.infer<typeof adjustmentSchema>

export default function NewStockMovementPage() {
  const t = useTranslations("StockMovements")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createMovement = useCreateStockMovement()
  const { data: items } = useItems()
  const { data: warehouses } = useWarehouses()

  const form = useForm<AdjustmentValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { quantity_delta: 0 },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const itemId = useWatch({ control, name: "item_id" })
  const warehouseId = useWatch({ control, name: "warehouse_id" })
  const quantityDelta = useWatch({ control, name: "quantity_delta" })

  const { data: itemStockRows } = useQuery({
    queryKey: ["item-stock", itemId],
    queryFn: () => fetchItemStock(itemId),
    enabled: !!itemId,
  })
  const currentQty = warehouseId ? (itemStockRows?.find((r) => r.warehouse_id === warehouseId)?.quantity_on_hand ?? 0) : null

  function onSubmit(values: AdjustmentValues) {
    createMovement.mutate(
      {
        item_id: values.item_id,
        warehouse_id: values.warehouse_id,
        quantity_delta: values.quantity_delta,
        notes: values.notes || null,
      },
      {
        onSuccess: () => {
          toast.success(tCommon("createdSuccess"))
          router.push(routes.inventory.movements.list)
        },
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Link href={routes.inventory.movements.list} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">{t("newAdjustment")}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!formState.errors.item_id}>
            <FieldLabel htmlFor="sm-item">{t("itemLabel")}</FieldLabel>
            <Select value={itemId} onValueChange={(value) => setValue("item_id", value)}>
              <SelectTrigger id="sm-item" className="w-full">
                <SelectValue placeholder={t("itemPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {items?.filter((i) => i.track_inventory).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formState.errors.item_id ? <FieldError>{tCommon("required")}</FieldError> : null}
          </Field>
          <Field data-invalid={!!formState.errors.warehouse_id}>
            <FieldLabel htmlFor="sm-warehouse">{t("warehouseLabel")}</FieldLabel>
            <Select value={warehouseId} onValueChange={(value) => setValue("warehouse_id", value)}>
              <SelectTrigger id="sm-warehouse" className="w-full">
                <SelectValue placeholder={t("warehousePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {warehouses?.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formState.errors.warehouse_id ? <FieldError>{tCommon("required")}</FieldError> : null}
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field>
            <FieldLabel>{t("currentQuantityLabel")}</FieldLabel>
            <div className="flex h-8 items-center rounded-lg border border-input px-2.5 text-sm text-muted-foreground">
              {currentQty === null ? t("currentQuantityPlaceholder") : currentQty}
            </div>
          </Field>
          <Field data-invalid={!!formState.errors.quantity_delta}>
            <FieldLabel htmlFor="sm-delta">{t("quantityDeltaLabel")}</FieldLabel>
            <Input id="sm-delta" type="number" step="any" placeholder={t("quantityDeltaHint")} {...register("quantity_delta", { valueAsNumber: true })} />
            {formState.errors.quantity_delta ? <FieldError>{tCommon("required")}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel>{t("resultingQuantityLabel")}</FieldLabel>
            <div className="flex h-8 items-center rounded-lg border border-input px-2.5 text-sm font-medium">
              {currentQty === null ? "—" : currentQty + (quantityDelta || 0)}
            </div>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="sm-notes">{t("notesLabel")}</FieldLabel>
          <Textarea id="sm-notes" placeholder={t("notesPlaceholder")} {...register("notes")} />
        </Field>

        <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <InfoIcon className="size-4 shrink-0" />
          <span>{t("adjustmentOnlyNote")}</span>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={createMovement.isPending}>
            {createMovement.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {t("createAdjustment")}
          </Button>
        </div>
      </form>
    </div>
  )
}
