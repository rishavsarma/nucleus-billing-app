"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { EntityFormDialog } from "@/components/entity-form-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SearchableSelect } from "@/components/searchable-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  useCreatePurchaseBillItem,
  useDeletePurchaseBillItem,
  usePurchaseBillItems,
  useUpdatePurchaseBillItem,
} from "@/hooks/use-purchase-bill-items"
import { useItem, useItemsList } from "@/hooks/use-items"
import { useTaxRates } from "@/hooks/use-tax-rates"
import type { PurchaseBillItem } from "@/lib/database/types"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const lineItemSchema = z.object({
  item_id: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().min(0.0001),
  unit_cost: z.number().min(0),
  unit_price: z.number().min(0),
  tax_rate: z.number().min(0).max(100),
})
type LineItemFormValues = z.infer<typeof lineItemSchema>

const NO_ITEM = "__none__"

export function PurchaseBillItemsSection({ purchaseBillId, editable }: { purchaseBillId: string; editable: boolean }) {
  const t = useTranslations("PurchaseBills")
  const tCommon = useTranslations("Common")

  const { data: lineItems } = usePurchaseBillItems(purchaseBillId)
  const { data: taxRates } = useTaxRates()
  const createLineItem = useCreatePurchaseBillItem()
  const updateLineItem = useUpdatePurchaseBillItem(purchaseBillId)
  const deleteLineItem = useDeletePurchaseBillItem(purchaseBillId)

  const [editing, setEditing] = useState<PurchaseBillItem | "new" | null>(null)
  const [toDelete, setToDelete] = useState<PurchaseBillItem | null>(null)

  // Catalog item picker searches the server instead of fetching every item
  // in the catalog (pageSize: 9999) and filtering client-side.
  const [itemSearch, setItemSearch] = useState("")
  const debouncedItemSearch = useDebouncedValue(itemSearch, 300)
  const { data: catalogItemsResult, isFetching: isFetchingCatalogItems } = useItemsList({
    search: debouncedItemSearch,
    page: 1,
    pageSize: 30,
  })
  const catalogItems = catalogItemsResult?.data ?? []

  const form = useForm<LineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    values:
      editing && editing !== "new"
        ? {
            item_id: editing.item_id ?? undefined,
            description: editing.description,
            quantity: editing.quantity,
            unit_cost: editing.unit_cost,
            unit_price: editing.unit_price,
            tax_rate: editing.tax_rate,
          }
        : { item_id: undefined, description: "", quantity: 1, unit_cost: 0, unit_price: 0, tax_rate: 0 },
  })
  const selectedItemId = useWatch({ control: form.control, name: "item_id" })
  // Resolved directly by id rather than found in catalogItems, since the
  // currently-selected item (e.g. when editing an existing line) may not
  // be part of the current search page.
  const { data: selectedItem } = useItem(selectedItemId)

  function onPickCatalogItem(itemId: string) {
    if (itemId === NO_ITEM) {
      form.setValue("item_id", undefined)
      return
    }
    const item = catalogItems?.find((i) => i.id === itemId)
    if (!item) return
    const taxRate = taxRates?.find((r) => r.id === item.tax_rate_id)
    form.setValue("item_id", itemId)
    form.setValue("description", item.name)
    form.setValue("unit_cost", item.purchase_price)
    form.setValue("unit_price", item.unit_price)
    if (taxRate) form.setValue("tax_rate", taxRate.rate)
  }

  function onSubmit(values: LineItemFormValues) {
    const input = {
      item_id: values.item_id || null,
      description: values.description,
      quantity: values.quantity,
      unit_cost: values.unit_cost,
      unit_price: values.unit_price,
      tax_rate: values.tax_rate,
    }
    if (editing && editing !== "new") {
      updateLineItem.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            toast.success(tCommon("updatedSuccess"))
            setEditing(null)
          },
          onError: () => toast.error(tCommon("genericError")),
        },
      )
    } else {
      createLineItem.mutate(
        { ...input, purchase_bill_id: purchaseBillId },
        {
          onSuccess: () => {
            toast.success(tCommon("createdSuccess"))
            setEditing(null)
          },
          onError: () => toast.error(tCommon("genericError")),
        },
      )
    }
  }

  const isSaving = createLineItem.isPending || updateLineItem.isPending

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t("lineItemsTitle")}</h2>
        {editable ? (
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <PlusIcon />
            {t("addLineItem")}
          </Button>
        ) : null}
      </div>
      <div className="p-3 sm:p-4 overflow-x-auto">
        {lineItems?.length ? (
          <Table className="whitespace-nowrap text-xs sm:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>{t("descriptionLabel")}</TableHead>
                <TableHead className="text-right">{t("quantityLabel")}</TableHead>
                <TableHead className="text-right">{t("unitCostLabel")}</TableHead>
                <TableHead className="text-right">{t("sellingPriceLabel")}</TableHead>
                <TableHead className="text-right">{t("taxRateLabel")}</TableHead>
                <TableHead className="text-right">{t("lineTotalLabel")}</TableHead>
                {editable ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{line.description}</TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">{money(line.unit_cost)}</TableCell>
                  <TableCell className="text-right">{money(line.unit_price)}</TableCell>
                  <TableCell className="text-right">{line.tax_rate}%</TableCell>
                  <TableCell className="text-right font-semibold">{money(line.line_total)}</TableCell>
                  {editable ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(line)}>
                          <PencilIcon />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setToDelete(line)}>
                          <TrashIcon />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("noLineItems")}</p>
        )}
      </div>

      <EntityFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={t("addLineItem")}
        onSubmit={form.handleSubmit(onSubmit)}
        isSubmitting={isSaving}
        submitLabel={editing !== "new" ? tCommon("save") : tCommon("create")}
      >
        <Field>
          <FieldLabel htmlFor="pbi-item">{t("itemLabel")}</FieldLabel>
          <SearchableSelect
            id="pbi-item"
            value={selectedItemId ?? NO_ITEM}
            onValueChange={onPickCatalogItem}
            placeholder={t("itemPlaceholder")}
            options={[
              { value: NO_ITEM, label: t("itemPlaceholder") },
              ...(selectedItem && !catalogItems.some((item) => item.id === selectedItem.id)
                ? [{ value: selectedItem.id, label: selectedItem.name }]
                : []),
              ...catalogItems.map((item) => ({ value: item.id, label: item.name })),
            ]}
            search={itemSearch}
            onSearchChange={setItemSearch}
            isLoading={isFetchingCatalogItems}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pbi-description">{t("descriptionLabel")}</FieldLabel>
          <Input id="pbi-description" {...form.register("description")} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field>
            <FieldLabel htmlFor="pbi-quantity">{t("quantityLabel")}</FieldLabel>
            <Input id="pbi-quantity" type="number" step="any" min={0} {...form.register("quantity", { valueAsNumber: true })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pbi-unit-cost">{t("unitCostLabel")}</FieldLabel>
            <Input id="pbi-unit-cost" type="number" step="0.01" min={0} {...form.register("unit_cost", { valueAsNumber: true })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pbi-unit-price">{t("sellingPriceLabel")}</FieldLabel>
            <Input id="pbi-unit-price" type="number" step="0.01" min={0} {...form.register("unit_price", { valueAsNumber: true })} />
            <p className="text-xs text-muted-foreground">{t("sellingPriceHint")}</p>
          </Field>
          <Field>
            <FieldLabel htmlFor="pbi-tax-rate">{t("taxRateLabel")}</FieldLabel>
            <Input id="pbi-tax-rate" type="number" step="0.01" min={0} max={100} {...form.register("tax_rate", { valueAsNumber: true })} />
          </Field>
        </div>
      </EntityFormDialog>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteLineItem.isPending}
        onConfirm={() => {
          if (!toDelete) return
          deleteLineItem.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(tCommon("deletedSuccess"))
              setToDelete(null)
            },
            onError: () => toast.error(tCommon("genericError")),
          })
        }}
      />
    </div>
  )
}
