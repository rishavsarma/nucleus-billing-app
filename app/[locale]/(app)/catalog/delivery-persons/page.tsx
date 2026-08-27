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
import {
  useCreateDeliveryPerson,
  useDeleteDeliveryPerson,
  useDeliveryPersonsList,
  useUpdateDeliveryPerson,
} from "@/hooks/use-delivery-persons"
import type { DeliveryPerson } from "@/lib/database/types"

const columnHelper = entityColumnHelper<DeliveryPerson>()

const deliveryPersonSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  is_active: z.boolean(),
})
type DeliveryPersonFormValues = z.infer<typeof deliveryPersonSchema>

function toFormValues(person?: DeliveryPerson): DeliveryPersonFormValues {
  return {
    name: person?.name ?? "",
    phone: person?.phone ?? "",
    is_active: person?.is_active ?? true,
  }
}

function toInput(values: DeliveryPersonFormValues) {
  return {
    name: values.name,
    phone: values.phone || null,
    is_active: values.is_active,
  }
}

export default function DeliveryPersonsPage() {
  const t = useTranslations("DeliveryPersons")
  const tFields = useTranslations("PartyFields")
  const tCommon = useTranslations("Common")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = useDeliveryPersonsList(params)
  const createDeliveryPerson = useCreateDeliveryPerson()
  const updateDeliveryPerson = useUpdateDeliveryPerson()
  const deleteDeliveryPerson = useDeleteDeliveryPerson()

  const [editing, setEditing] = useState<DeliveryPerson | "new" | null>(null)
  const [toDelete, setToDelete] = useState<DeliveryPerson | null>(null)

  const form = useForm<DeliveryPersonFormValues>({
    resolver: zodResolver(deliveryPersonSchema),
    values: toFormValues(editing && editing !== "new" ? editing : undefined),
  })
  const isActive = useWatch({ control: form.control, name: "is_active" })

  const isSaving = createDeliveryPerson.isPending || updateDeliveryPerson.isPending

  function onSubmit(values: DeliveryPersonFormValues) {
    const input = toInput(values)
    if (editing && editing !== "new") {
      updateDeliveryPerson.mutate(
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
      createDeliveryPerson.mutate(input, {
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
    columnHelper.accessor("phone", {
      header: t("columnPhone"),
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() || "—"}</span>,
    }),
    columnHelper.accessor("is_active", {
      header: t("columnStatus"),
      cell: ({ getValue }) => (
        <Badge variant={getValue() ? "outline" : "secondary"}>
          {getValue() ? t("statusActive") : t("statusInactive")}
        </Badge>
      ),
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
          {t("newDeliveryPerson")}
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
        title={editing !== "new" ? t("editDeliveryPerson") : t("newDeliveryPerson")}
        description={editing !== "new" ? t("editDescription") : t("newDescription")}
        onSubmit={form.handleSubmit(onSubmit)}
        isSubmitting={isSaving}
        submitLabel={editing !== "new" ? tCommon("save") : tCommon("create")}
      >
        <Field>
          <FieldLabel htmlFor="dp-name">{t("nameLabel")}</FieldLabel>
          <Input id="dp-name" {...form.register("name")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="dp-phone">{tFields("phone")}</FieldLabel>
          <Input id="dp-phone" {...form.register("phone")} />
        </Field>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="dp-active">{t("activeLabel")}</FieldLabel>
          <Switch
            id="dp-active"
            checked={isActive}
            onCheckedChange={(checked) => form.setValue("is_active", checked)}
          />
        </Field>
      </EntityFormDialog>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteDeliveryPerson.isPending}
        description={t("deleteDescription")}
        onConfirm={() => {
          if (!toDelete) return
          deleteDeliveryPerson.mutate(toDelete.id, {
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
