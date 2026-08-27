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
import { DatePicker } from "@/components/ui/date-picker"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { EntityFormDialog } from "@/components/entity-form-dialog"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  useCreatePdfWatermark,
  useDeletePdfWatermark,
  usePdfWatermarksList,
  useUpdatePdfWatermark,
} from "@/hooks/use-pdf-watermarks"
import type { PdfWatermark } from "@/lib/database/types"

const columnHelper = entityColumnHelper<PdfWatermark>()

const watermarkSchema = z
  .object({
    name: z.string().min(1),
    text: z.string().min(1),
    starts_on: z.string().min(1),
    ends_on: z.string().min(1),
    is_active: z.boolean(),
  })
  .refine((values) => values.ends_on >= values.starts_on, {
    message: "End date must be on or after the start date",
    path: ["ends_on"],
  })
type WatermarkFormValues = z.infer<typeof watermarkSchema>

function toFormValues(watermark?: PdfWatermark): WatermarkFormValues {
  const today = new Date().toISOString().slice(0, 10)
  return {
    name: watermark?.name ?? "",
    text: watermark?.text ?? "",
    starts_on: watermark?.starts_on ?? today,
    ends_on: watermark?.ends_on ?? today,
    is_active: watermark?.is_active ?? true,
  }
}

export default function PdfWatermarksPage() {
  const t = useTranslations("PdfWatermarks")
  const tCommon = useTranslations("Common")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = usePdfWatermarksList(params)
  const createWatermark = useCreatePdfWatermark()
  const updateWatermark = useUpdatePdfWatermark()
  const deleteWatermark = useDeletePdfWatermark()

  const [editing, setEditing] = useState<PdfWatermark | "new" | null>(null)
  const [toDelete, setToDelete] = useState<PdfWatermark | null>(null)

  const form = useForm<WatermarkFormValues>({
    resolver: zodResolver(watermarkSchema),
    values: toFormValues(editing && editing !== "new" ? editing : undefined),
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const isActive = useWatch({ control, name: "is_active" })
  const startsOn = useWatch({ control, name: "starts_on" })
  const endsOn = useWatch({ control, name: "ends_on" })

  const isSaving = createWatermark.isPending || updateWatermark.isPending

  function onSubmit(values: WatermarkFormValues) {
    if (editing && editing !== "new") {
      updateWatermark.mutate(
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
      createWatermark.mutate(values, {
        onSuccess: () => {
          toast.success(tCommon("createdSuccess"))
          setEditing(null)
        },
        onError: () => toast.error(tCommon("genericError")),
      })
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const columns = [
    columnHelper.accessor("name", {
      header: t("columnName"),
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    }),
    columnHelper.accessor("text", {
      header: t("columnText"),
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
    }),
    columnHelper.display({
      id: "window",
      header: t("columnWindow"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.starts_on} – {row.original.ends_on}
        </span>
      ),
    }),
    columnHelper.display({
      id: "status",
      header: t("columnStatus"),
      cell: ({ row }) => {
        const w = row.original
        const isCurrentlyActive = w.is_active && w.starts_on <= today && w.ends_on >= today
        if (isCurrentlyActive) return <Badge>{t("statusLive")}</Badge>
        if (!w.is_active) return <Badge variant="secondary">{t("statusDisabled")}</Badge>
        return <Badge variant="outline">{t("statusScheduled")}</Badge>
      },
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
          {t("newWatermark")}
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
        title={editing !== "new" ? t("editWatermark") : t("newWatermark")}
        description={editing !== "new" ? t("editDescription") : t("newDescription")}
        onSubmit={handleSubmit(onSubmit)}
        isSubmitting={isSaving}
        submitLabel={editing !== "new" ? tCommon("save") : tCommon("create")}
      >
        <Field data-invalid={!!formState.errors.name}>
          <FieldLabel htmlFor="wm-name">{t("nameLabel")}</FieldLabel>
          <Input id="wm-name" placeholder={t("namePlaceholder")} {...register("name")} />
        </Field>
        <Field data-invalid={!!formState.errors.text}>
          <FieldLabel htmlFor="wm-text">{t("textLabel")}</FieldLabel>
          <Input id="wm-text" placeholder={t("textPlaceholder")} {...register("text")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="wm-start">{t("startsOnLabel")}</FieldLabel>
            <DatePicker
              id="wm-start"
              value={startsOn}
              onChange={(value) => setValue("starts_on", value, { shouldValidate: true })}
            />
          </Field>
          <Field data-invalid={!!formState.errors.ends_on}>
            <FieldLabel htmlFor="wm-end">{t("endsOnLabel")}</FieldLabel>
            <DatePicker
              id="wm-end"
              value={endsOn}
              onChange={(value) => setValue("ends_on", value, { shouldValidate: true })}
            />
          </Field>
        </div>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="wm-active">{t("activeLabel")}</FieldLabel>
          <Switch
            id="wm-active"
            checked={isActive}
            onCheckedChange={(checked) => setValue("is_active", checked)}
          />
        </Field>
      </EntityFormDialog>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteWatermark.isPending}
        description={t("deleteDescription")}
        onConfirm={() => {
          if (!toDelete) return
          deleteWatermark.mutate(toDelete.id, {
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
