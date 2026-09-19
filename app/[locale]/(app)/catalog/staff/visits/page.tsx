"use client"

import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { useForm, useWatch } from "react-hook-form"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, TrashIcon, XIcon } from "lucide-react"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CustomerSelect } from "@/components/customer-select"
import { DatePicker } from "@/components/ui/date-picker"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { EntityFormDialog } from "@/components/entity-form-dialog"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useStaffList } from "@/hooks/use-staff"
import {
  useCreateStaffVisit,
  useDeleteStaffVisit,
  useStaffVisitsList,
  useUpdateStaffVisit,
} from "@/hooks/use-staff-visits"
import type { StaffVisit, StaffVisitStatus } from "@/lib/database/types"

const columnHelper = entityColumnHelper<StaffVisit>()
const STATUSES: StaffVisitStatus[] = ["planned", "completed", "cancelled"]
const ALL = "__all__"

const STATUS_TONE: Record<StaffVisitStatus, string> = {
  planned: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  completed:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
}

const visitSchema = z.object({
  staff_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  place: z.string().trim().min(1),
  customer_id: z.string().nullable(),
  purpose: z.string().optional(),
  outcome: z.string().optional(),
  status: z.enum(["planned", "completed", "cancelled"]),
})
type VisitFormValues = z.infer<typeof visitSchema>

function toFormValues(visit?: StaffVisit): VisitFormValues {
  // visit_at is stored as timestamptz; the form edits it in the browser's
  // local time, which is what the person logging the visit means by "11:30".
  const when = visit ? new Date(visit.visit_at) : new Date()
  return {
    staff_id: visit?.staff_id ?? "",
    date: format(when, "yyyy-MM-dd"),
    time: format(when, "HH:mm"),
    place: visit?.place ?? "",
    customer_id: visit?.customer_id ?? null,
    purpose: visit?.purpose ?? "",
    outcome: visit?.outcome ?? "",
    status: visit?.status ?? "planned",
  }
}

function toInput(values: VisitFormValues): Partial<StaffVisit> {
  return {
    staff_id: values.staff_id,
    visit_at: new Date(`${values.date}T${values.time}`).toISOString(),
    place: values.place.trim(),
    customer_id: values.customer_id,
    purpose: values.purpose?.trim() || null,
    outcome: values.outcome?.trim() || null,
    status: values.status,
  }
}

export default function StaffVisitsPage() {
  const t = useTranslations("StaffVisits")
  const tStatus = useTranslations("VisitStatus")
  const tCommon = useTranslations("Common")
  const locale = useLocale()

  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [staffFilter, setStaffFilter] = useState<string>(ALL)
  const { params, tableControlProps } = useServerTableParams()
  const listParams = useMemo(
    () => ({
      ...params,
      status:
        statusFilter === ALL ? undefined : (statusFilter as StaffVisitStatus),
      staff_id: staffFilter === ALL ? undefined : staffFilter,
    }),
    [params, statusFilter, staffFilter]
  )
  const { data: result, isLoading } = useStaffVisitsList(listParams)

  // The API caps pages at 100 — plenty for a picker of an org's staff.
  const { data: staffPage } = useStaffList({ page: 1, pageSize: 100 })
  const allStaff = staffPage?.data ?? []
  const activeStaff = allStaff.filter((person) => person.is_active)

  const createVisit = useCreateStaffVisit()
  const updateVisit = useUpdateStaffVisit()
  const deleteVisit = useDeleteStaffVisit()

  const [editing, setEditing] = useState<StaffVisit | "new" | null>(null)
  const [toDelete, setToDelete] = useState<StaffVisit | null>(null)

  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitSchema),
    values: toFormValues(editing && editing !== "new" ? editing : undefined),
  })
  const staffId = useWatch({ control: form.control, name: "staff_id" })
  const date = useWatch({ control: form.control, name: "date" })
  const customerId = useWatch({ control: form.control, name: "customer_id" })
  const status = useWatch({ control: form.control, name: "status" })
  const errors = form.formState.errors

  const isSaving = createVisit.isPending || updateVisit.isPending

  // When editing a visit whose staff member has since been deactivated, keep
  // them selectable so the form doesn't silently blank the field.
  const staffOptions =
    editing &&
    editing !== "new" &&
    !activeStaff.some((p) => p.id === editing.staff_id)
      ? [...activeStaff, ...allStaff.filter((p) => p.id === editing.staff_id)]
      : activeStaff

  const dateTimeFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [locale]
  )

  function onSubmit(values: VisitFormValues) {
    const input = toInput(values)
    const done = (message: string) => () => {
      toast.success(message)
      setEditing(null)
    }
    const failed = () => toast.error(tCommon("genericError"))
    if (editing && editing !== "new") {
      updateVisit.mutate(
        { id: editing.id, input },
        { onSuccess: done(tCommon("updatedSuccess")), onError: failed }
      )
    } else {
      createVisit.mutate(input, {
        onSuccess: done(tCommon("createdSuccess")),
        onError: failed,
      })
    }
  }

  const columns = [
    columnHelper.accessor("visit_at", {
      header: t("columnWhen"),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap tabular-nums">
          {dateTimeFormat.format(new Date(getValue()))}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.staff?.name ?? "—", {
      id: "staff",
      header: t("columnStaff"),
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    }),
    columnHelper.accessor("place", {
      header: t("columnPlace"),
      cell: ({ getValue }) => (
        <span className="line-clamp-2 min-w-40">{getValue()}</span>
      ),
    }),
    columnHelper.accessor((row) => row.customer?.name ?? "", {
      id: "customer",
      header: t("columnCustomer"),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue() || "—"}</span>
      ),
    }),
    columnHelper.accessor("purpose", {
      header: t("columnPurpose"),
      cell: ({ getValue }) => (
        <span className="line-clamp-2 min-w-40 text-muted-foreground">
          {getValue() || "—"}
        </span>
      ),
    }),
    columnHelper.accessor("status", {
      header: t("columnStatus"),
      cell: ({ getValue }) => (
        <Badge
          variant="outline"
          className={cn("border-transparent", STATUS_TONE[getValue()])}
        >
          {tStatus(getValue())}
        </Badge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditing(row.original)}
            aria-label={tCommon("edit")}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setToDelete(row.original)}
            aria-label={tCommon("delete")}
          >
            <TrashIcon />
          </Button>
        </div>
      ),
    }),
  ]

  const filters = (
    <div className="flex flex-wrap gap-2">
      <Select
        value={staffFilter}
        onValueChange={(value) => {
          setStaffFilter(value)
          tableControlProps.onPageChange(1)
        }}
      >
        <SelectTrigger className="w-40" aria-label={t("columnStaff")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allStaff")}</SelectItem>
          {allStaff.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={statusFilter}
        onValueChange={(value) => {
          setStatusFilter(value)
          tableControlProps.onPageChange(1)
        }}
      >
        <SelectTrigger className="w-36" aria-label={t("columnStatus")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
          {STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {tStatus(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon />
          {t("newVisit")}
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
        toolbarExtra={filters}
      />

      <EntityFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing !== "new" ? t("editVisit") : t("newVisit")}
        description={
          editing !== "new" ? t("editDescription") : t("newDescription")
        }
        onSubmit={form.handleSubmit(onSubmit)}
        isSubmitting={isSaving}
        submitLabel={editing !== "new" ? tCommon("save") : tCommon("create")}
      >
        <Field data-invalid={!!errors.staff_id}>
          <FieldLabel htmlFor="visit-staff">{t("staffLabel")}</FieldLabel>
          <Select
            value={staffId || undefined}
            onValueChange={(value) =>
              form.setValue("staff_id", value, { shouldValidate: true })
            }
          >
            <SelectTrigger id="visit-staff" className="w-full">
              <SelectValue placeholder={t("staffPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {staffOptions.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.date}>
            <FieldLabel htmlFor="visit-date">{t("dateLabel")}</FieldLabel>
            <DatePicker
              id="visit-date"
              value={date}
              onChange={(value) =>
                form.setValue("date", value, { shouldValidate: true })
              }
              className="w-full"
            />
          </Field>
          <Field data-invalid={!!errors.time}>
            <FieldLabel htmlFor="visit-time">{t("timeLabel")}</FieldLabel>
            <Input id="visit-time" type="time" {...form.register("time")} />
          </Field>
        </div>

        <Field data-invalid={!!errors.place}>
          <FieldLabel htmlFor="visit-place">{t("placeLabel")}</FieldLabel>
          <Input
            id="visit-place"
            placeholder={t("placePlaceholder")}
            {...form.register("place")}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="visit-customer">{t("customerLabel")}</FieldLabel>
          <div className="flex gap-2">
            <CustomerSelect
              id="visit-customer"
              value={customerId}
              onValueChange={(value) => form.setValue("customer_id", value)}
              placeholder={t("customerPlaceholder")}
              className="min-w-0 flex-1"
            />
            {customerId ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => form.setValue("customer_id", null)}
                aria-label={t("clearCustomer")}
              >
                <XIcon />
              </Button>
            ) : null}
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="visit-purpose">{t("purposeLabel")}</FieldLabel>
          <Input
            id="visit-purpose"
            placeholder={t("purposePlaceholder")}
            {...form.register("purpose")}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="visit-outcome">{t("outcomeLabel")}</FieldLabel>
          <Textarea
            id="visit-outcome"
            rows={3}
            placeholder={t("outcomePlaceholder")}
            {...form.register("outcome")}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="visit-status">{t("statusLabel")}</FieldLabel>
          <Select
            value={status}
            onValueChange={(value) =>
              form.setValue("status", value as StaffVisitStatus)
            }
          >
            <SelectTrigger id="visit-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tStatus(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </EntityFormDialog>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteVisit.isPending}
        description={t("deleteDescription")}
        onConfirm={() => {
          if (!toDelete) return
          deleteVisit.mutate(toDelete.id, {
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
