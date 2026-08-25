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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useCreateWarehouse, useDeleteWarehouse, useUpdateWarehouse, useWarehouses } from "@/hooks/use-warehouses"
import type { Warehouse } from "@/lib/database/types"

const columnHelper = entityColumnHelper<Warehouse>()

const warehouseSchema = z.object({
  name: z.string().min(1),
  address_line: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  is_default: z.boolean(),
})
type WarehouseFormValues = z.infer<typeof warehouseSchema>

type Address = { line1?: string; city?: string; state?: string }

function toFormValues(warehouse?: Warehouse): WarehouseFormValues {
  const address = (warehouse?.address ?? {}) as Address
  return {
    name: warehouse?.name ?? "",
    address_line: address.line1 ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    is_default: warehouse?.is_default ?? false,
  }
}

function toInput(values: WarehouseFormValues) {
  return {
    name: values.name,
    is_default: values.is_default,
    address: { line1: values.address_line || null, city: values.city || null, state: values.state || null },
  }
}

export default function WarehousesPage() {
  const t = useTranslations("Warehouses")
  const tFields = useTranslations("PartyFields")
  const tCommon = useTranslations("Common")
  const { data: warehouses, isLoading } = useWarehouses()
  const createWarehouse = useCreateWarehouse()
  const updateWarehouse = useUpdateWarehouse()
  const deleteWarehouse = useDeleteWarehouse()

  const [editing, setEditing] = useState<Warehouse | "new" | null>(null)
  const [toDelete, setToDelete] = useState<Warehouse | null>(null)

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    values: toFormValues(editing && editing !== "new" ? editing : undefined),
  })
  const isDefault = useWatch({ control: form.control, name: "is_default" })

  const isSaving = createWarehouse.isPending || updateWarehouse.isPending

  function onSubmit(values: WarehouseFormValues) {
    const input = toInput(values)
    if (editing && editing !== "new") {
      updateWarehouse.mutate(
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
      createWarehouse.mutate(input, {
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
    columnHelper.display({
      id: "address",
      header: t("columnAddress"),
      cell: ({ row }) => {
        const address = (row.original.address ?? {}) as Address
        return <span className="text-muted-foreground">{[address.city, address.state].filter(Boolean).join(", ") || "—"}</span>
      },
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
          {t("newWarehouse")}
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={warehouses ?? []}
        isLoading={isLoading}
        searchPlaceholder={t("searchPlaceholder")}
        matchesSearch={(row, query) => row.name.toLowerCase().includes(query)}
        emptyMessage={t("noResults")}
      />

      <EntityFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing !== "new" ? t("editWarehouse") : t("newWarehouse")}
        description={editing !== "new" ? t("editDescription") : t("newDescription")}
        onSubmit={form.handleSubmit(onSubmit)}
        isSubmitting={isSaving}
        submitLabel={editing !== "new" ? tCommon("save") : tCommon("create")}
      >
        <Field>
          <FieldLabel htmlFor="wh-name">{t("nameLabel")}</FieldLabel>
          <Input id="wh-name" {...form.register("name")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="wh-address">{tFields("addressLine")}</FieldLabel>
          <Input id="wh-address" {...form.register("address_line")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="wh-city">{tFields("city")}</FieldLabel>
            <Input id="wh-city" {...form.register("city")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="wh-state">{tFields("state")}</FieldLabel>
            <Input id="wh-state" {...form.register("state")} />
          </Field>
        </div>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="wh-default">{t("defaultLabel")}</FieldLabel>
          <Switch
            id="wh-default"
            checked={isDefault}
            onCheckedChange={(checked) => form.setValue("is_default", checked)}
          />
        </Field>
      </EntityFormDialog>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteWarehouse.isPending}
        description={t("deleteDescription")}
        onConfirm={() => {
          if (!toDelete) return
          deleteWarehouse.mutate(toDelete.id, {
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
