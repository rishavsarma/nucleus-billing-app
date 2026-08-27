"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { EntityFormDialog } from "@/components/entity-form-dialog"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useCreateTaxRate, useDeleteTaxRate, useTaxRatesList, useUpdateTaxRate } from "@/hooks/use-tax-rates"
import type { TaxRate } from "@/lib/database/types"

const columnHelper = entityColumnHelper<TaxRate>()

const taxRateSchema = z.object({
  name: z.string().min(1),
  rate: z.number().min(0).max(100),
  is_default: z.boolean(),
})
type TaxRateFormValues = z.infer<typeof taxRateSchema>

export default function TaxRatesPage() {
  const t = useTranslations("TaxRates")
  const tCommon = useTranslations("Common")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = useTaxRatesList(params)
  const createTaxRate = useCreateTaxRate()
  const updateTaxRate = useUpdateTaxRate()
  const deleteTaxRate = useDeleteTaxRate()

  const [editing, setEditing] = useState<TaxRate | "new" | null>(null)
  const [toDelete, setToDelete] = useState<TaxRate | null>(null)

  const form = useForm<TaxRateFormValues>({
    resolver: zodResolver(taxRateSchema),
    values:
      editing && editing !== "new"
        ? { name: editing.name, rate: editing.rate, is_default: editing.is_default }
        : { name: "", rate: 0, is_default: false },
  })
  const isDefault = useWatch({ control: form.control, name: "is_default" })

  const isSaving = createTaxRate.isPending || updateTaxRate.isPending

  function onSubmit(values: TaxRateFormValues) {
    if (editing && editing !== "new") {
      updateTaxRate.mutate(
        { id: editing.id, input: values },
        {
          onSuccess: () => {
            toast.success(tCommon("updatedSuccess"))
            setEditing(null)
          },
          onError: () => toast.error(tCommon("genericError")),
        },
      )
    } else {
      createTaxRate.mutate(values, {
        onSuccess: () => {
          toast.success(tCommon("createdSuccess"))
          setEditing(null)
        },
        onError: () => toast.error(tCommon("genericError")),
      })
    }
  }

  const columns = [
    columnHelper.accessor("name", {
      header: t("columnName"),
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    }),
    columnHelper.accessor("rate", {
      header: t("columnRate"),
      cell: ({ getValue }) => <span>{getValue()}%</span>,
    }),
    columnHelper.accessor("is_default", {
      header: t("columnDefault"),
      cell: ({ getValue }) => (getValue() ? <Badge variant="outline">{t("columnDefault")}</Badge> : null),
    }),
    columnHelper.display({
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(row.original)}>
            <PencilIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setToDelete(row.original)}>
            <TrashIcon />
          </Button>
        </div>
      ),
    }),
  ]

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon />
          {t("newTaxRate")}
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={result?.data ?? []}
        isLoading={isLoading}
        totalCount={result?.total ?? 0}
        {...tableControlProps}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("noResults")}
      />

      <EntityFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing !== "new" ? t("editTaxRate") : t("newTaxRate")}
        description={editing !== "new" ? t("editDescription") : t("newDescription")}
        onSubmit={form.handleSubmit(onSubmit)}
        isSubmitting={isSaving}
        submitLabel={editing !== "new" ? tCommon("save") : tCommon("create")}
      >
        <Field>
          <FieldLabel htmlFor="tr-name">{t("nameLabel")}</FieldLabel>
          <Input id="tr-name" {...form.register("name")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="tr-rate">{t("rateLabel")}</FieldLabel>
          <Input
            id="tr-rate"
            type="number"
            step="0.01"
            min={0}
            max={100}
            {...form.register("rate", { valueAsNumber: true })}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="tr-default">{t("defaultLabel")}</FieldLabel>
          <Switch
            id="tr-default"
            checked={isDefault}
            onCheckedChange={(checked) => form.setValue("is_default", checked)}
          />
        </Field>
      </EntityFormDialog>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteTaxRate.isPending}
        description={t("deleteDescription")}
        onConfirm={() => {
          if (!toDelete) return
          deleteTaxRate.mutate(toDelete.id, {
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
