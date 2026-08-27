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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  useCreateStaff,
  useDeleteStaff,
  useStaffList,
  useUpdateStaff,
} from "@/hooks/use-staff"
import type { Staff } from "@/lib/database/types"

const columnHelper = entityColumnHelper<Staff>()
const ROLES = ["delivery_person", "mover", "other"] as const

const staffSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(ROLES),
  role_label: z.string().optional(),
  is_active: z.boolean(),
})
type StaffFormValues = z.infer<typeof staffSchema>

function toFormValues(person?: Staff): StaffFormValues {
  return {
    name: person?.name ?? "",
    phone: person?.phone ?? "",
    role: person?.role ?? "delivery_person",
    role_label: person?.role_label ?? "",
    is_active: person?.is_active ?? true,
  }
}

function toInput(values: StaffFormValues) {
  return {
    name: values.name,
    phone: values.phone || null,
    role: values.role,
    role_label: values.role === "other" ? values.role_label || null : null,
    is_active: values.is_active,
  }
}

export default function StaffPage() {
  const t = useTranslations("Staff")
  const tRoles = useTranslations("StaffRoles")
  const tFields = useTranslations("PartyFields")
  const tCommon = useTranslations("Common")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = useStaffList(params)
  const createStaff = useCreateStaff()
  const updateStaff = useUpdateStaff()
  const deleteStaff = useDeleteStaff()

  const [editing, setEditing] = useState<Staff | "new" | null>(null)
  const [toDelete, setToDelete] = useState<Staff | null>(null)

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    values: toFormValues(editing && editing !== "new" ? editing : undefined),
  })
  const isActive = useWatch({ control: form.control, name: "is_active" })
  const selectedRole = useWatch({ control: form.control, name: "role" })

  const isSaving = createStaff.isPending || updateStaff.isPending

  function roleLabel(person: Staff) {
    if (person.role === "other") return person.role_label || tRoles("other")
    return tRoles(person.role)
  }

  function onSubmit(values: StaffFormValues) {
    const input = toInput(values)
    if (editing && editing !== "new") {
      updateStaff.mutate(
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
      createStaff.mutate(input, {
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
    columnHelper.accessor("role", {
      header: t("columnRole"),
      cell: ({ row }) => <Badge variant="outline">{roleLabel(row.original)}</Badge>,
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
          {t("newStaff")}
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
        title={editing !== "new" ? t("editStaff") : t("newStaff")}
        description={editing !== "new" ? t("editDescription") : t("newDescription")}
        onSubmit={form.handleSubmit(onSubmit)}
        isSubmitting={isSaving}
        submitLabel={editing !== "new" ? tCommon("save") : tCommon("create")}
      >
        <Field>
          <FieldLabel htmlFor="staff-name">{t("nameLabel")}</FieldLabel>
          <Input id="staff-name" {...form.register("name")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="staff-role">{t("roleLabel")}</FieldLabel>
          <Select value={selectedRole} onValueChange={(value) => form.setValue("role", value as StaffFormValues["role"])}>
            <SelectTrigger id="staff-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {tRoles(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {selectedRole === "other" ? (
          <Field>
            <FieldLabel htmlFor="staff-role-label">{t("roleLabelFieldLabel")}</FieldLabel>
            <Input
              id="staff-role-label"
              placeholder={t("roleLabelPlaceholder")}
              {...form.register("role_label")}
            />
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="staff-phone">{tFields("phone")}</FieldLabel>
          <Input id="staff-phone" {...form.register("phone")} />
        </Field>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="staff-active">{t("activeLabel")}</FieldLabel>
          <Switch
            id="staff-active"
            checked={isActive}
            onCheckedChange={(checked) => form.setValue("is_active", checked)}
          />
        </Field>
      </EntityFormDialog>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteStaff.isPending}
        description={t("deleteDescription")}
        onConfirm={() => {
          if (!toDelete) return
          deleteStaff.mutate(toDelete.id, {
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
