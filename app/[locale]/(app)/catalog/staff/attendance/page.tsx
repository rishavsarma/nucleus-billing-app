"use client"

import { useMemo, useState } from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isWeekend,
  parse,
  startOfMonth,
} from "date-fns"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  CheckCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  SaveIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import {
  useAttendanceRange,
  useDeleteAttendance,
  useSaveAttendanceDay,
} from "@/hooks/use-staff-attendance"
import { useStaffList } from "@/hooks/use-staff"
import type { AttendanceStatus, Staff } from "@/lib/database/types"

const STATUSES: AttendanceStatus[] = ["present", "absent", "half_day", "leave"]

/** The API caps list pages at 100 (MAX_PAGE_SIZE). */
const STAFF_PAGE_SIZE = 100

/** Semantic colour per status, used for the toggles and the register cells. */
const STATUS_TONE: Record<AttendanceStatus, string> = {
  present:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  absent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  half_day: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  leave: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
}

type Draft = { status?: AttendanceStatus; note: string }

function todayIso() {
  return format(new Date(), "yyyy-MM-dd")
}

export default function StaffAttendancePage() {
  const t = useTranslations("StaffAttendance")
  const tRoles = useTranslations("StaffRoles")

  const { data: staffPage, isLoading: staffLoading } = useStaffList({
    page: 1,
    pageSize: STAFF_PAGE_SIZE,
  })
  const activeStaff = useMemo(
    () => (staffPage?.data ?? []).filter((person) => person.is_active),
    [staffPage]
  )
  const truncated = (staffPage?.total ?? 0) > STAFF_PAGE_SIZE

  function roleLabel(person: Staff) {
    if (person.role === "other") return person.role_label || tRoles("other")
    return tRoles(person.role)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">{t("tabDaily")}</TabsTrigger>
          <TabsTrigger value="register">{t("tabRegister")}</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <DailySheet
            staff={activeStaff}
            staffLoading={staffLoading}
            truncated={truncated}
            roleLabel={roleLabel}
          />
        </TabsContent>
        <TabsContent value="register" className="mt-4">
          <MonthlyRegister
            staff={activeStaff}
            staffLoading={staffLoading}
            truncated={truncated}
          />
        </TabsContent>
      </Tabs>

      <p className="mt-2 text-xs text-muted-foreground">{t("legend")}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Daily sheet — mark one day for everyone, then save the whole day at once.
// ---------------------------------------------------------------------------

function DailySheet({
  staff,
  staffLoading,
  truncated,
  roleLabel,
}: {
  staff: Staff[]
  staffLoading: boolean
  truncated: boolean
  roleLabel: (person: Staff) => string
}) {
  const t = useTranslations("StaffAttendance")
  const tStatus = useTranslations("AttendanceStatus")
  const tCommon = useTranslations("Common")

  const [date, setDate] = useState(todayIso)
  // Edits are kept as overrides on top of what the server has, keyed by
  // date, rather than copying server rows into state — so switching dates or
  // a refetch never needs a sync effect, and unsaved edits for one day don't
  // leak onto another.
  const [overrides, setOverrides] = useState<
    Record<string, Record<string, Draft>>
  >({})

  const { data: rows, isLoading } = useAttendanceRange(date, date)
  const saveDay = useSaveAttendanceDay()
  const deleteMark = useDeleteAttendance()

  const saved = useMemo(() => {
    const byStaff = new Map<
      string,
      { id: string; status: AttendanceStatus; note: string }
    >()
    for (const row of rows ?? []) {
      byStaff.set(row.staff_id, {
        id: row.id,
        status: row.status,
        note: row.note ?? "",
      })
    }
    return byStaff
  }, [rows])

  const dayOverrides = overrides[date] ?? {}

  function effective(staffId: string): Draft {
    return (
      dayOverrides[staffId] ?? {
        status: saved.get(staffId)?.status,
        note: saved.get(staffId)?.note ?? "",
      }
    )
  }

  function edit(staffId: string, patch: Partial<Draft>) {
    setOverrides((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] ?? {}),
        [staffId]: { ...effective(staffId), ...patch },
      },
    }))
  }

  const isDirty = Object.entries(dayOverrides).some(([staffId, draft]) => {
    const server = saved.get(staffId)
    return (
      draft.status !== server?.status || draft.note !== (server?.note ?? "")
    )
  })

  const markedCount = staff.filter(
    (person) => effective(person.id).status
  ).length

  function markAllPresent() {
    setOverrides((prev) => {
      const next = { ...(prev[date] ?? {}) }
      for (const person of staff) {
        const current = next[person.id] ?? effective(person.id)
        next[person.id] = { ...current, status: "present" }
      }
      return { ...prev, [date]: next }
    })
  }

  function clearMark(staffId: string) {
    const existing = saved.get(staffId)
    const dropOverride = () =>
      setOverrides((prev) => {
        const day = { ...(prev[date] ?? {}) }
        delete day[staffId]
        return { ...prev, [date]: day }
      })
    if (!existing) {
      // Only an unsaved local mark — nothing on the server to delete.
      setOverrides((prev) => ({
        ...prev,
        [date]: {
          ...(prev[date] ?? {}),
          [staffId]: { status: undefined, note: "" },
        },
      }))
      return
    }
    deleteMark.mutate(existing.id, {
      onSuccess: dropOverride,
      onError: () => toast.error(tCommon("genericError")),
    })
  }

  function save() {
    const entries = staff.flatMap((person) => {
      const draft = effective(person.id)
      return draft.status
        ? [
            {
              staff_id: person.id,
              status: draft.status,
              note: draft.note.trim() || null,
            },
          ]
        : []
    })
    if (entries.length === 0) {
      toast.error(t("nothingToSave"))
      return
    }
    saveDay.mutate(
      { attendance_date: date, entries },
      {
        onSuccess: () => {
          toast.success(t("saved"))
          setOverrides((prev) => {
            const next = { ...prev }
            delete next[date]
            return next
          })
        },
        onError: () => toast.error(tCommon("genericError")),
      }
    )
  }

  if (staffLoading) {
    return <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
  }
  if (staff.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noStaff")}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("dateLabel")}</span>
            <DatePicker
              value={date}
              onChange={(value) => value && setDate(value)}
              className="w-44"
            />
          </div>
          <span className="pb-2 text-sm text-muted-foreground tabular-nums">
            {t("markedCount", { marked: markedCount, total: staff.length })}
          </span>
          {isDirty ? (
            <Badge variant="secondary" className="mb-2">
              {t("unsaved")}
            </Badge>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAllPresent}>
            <CheckCheckIcon />
            {t("markAllPresent")}
          </Button>
          <Button onClick={save} disabled={saveDay.isPending || !isDirty}>
            {saveDay.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SaveIcon />
            )}
            {t("save")}
          </Button>
        </div>
      </div>

      {truncated ? (
        <p className="text-xs text-muted-foreground">{t("tooManyStaff")}</p>
      ) : null}

      <div className="divide-y rounded-lg border">
        {staff.map((person) => {
          const draft = effective(person.id)
          return (
            <div
              key={person.id}
              className={cn(
                "flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4",
                isLoading && "opacity-60"
              )}
            >
              <div className="min-w-0 sm:w-48">
                <p className="truncate font-medium">{person.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {roleLabel(person)}
                </p>
              </div>

              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={draft.status ?? ""}
                onValueChange={(value) =>
                  value &&
                  edit(person.id, { status: value as AttendanceStatus })
                }
                className="flex-wrap justify-start"
                aria-label={person.name}
              >
                {STATUSES.map((status) => (
                  <ToggleGroupItem
                    key={status}
                    value={status}
                    className={cn(
                      draft.status === status && STATUS_TONE[status],
                      "data-[state=on]:font-semibold"
                    )}
                  >
                    {tStatus(status)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <Input
                value={draft.note}
                onChange={(event) =>
                  edit(person.id, { note: event.target.value })
                }
                placeholder={t("notePlaceholder")}
                className="sm:max-w-xs"
                maxLength={500}
                disabled={!draft.status}
              />

              <div className="flex items-center gap-2 sm:ml-auto">
                {!draft.status ? (
                  <span className="text-xs text-muted-foreground">
                    {t("notMarked")}
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearMark(person.id)}
                    disabled={deleteMark.isPending}
                  >
                    <XIcon />
                    {t("clearMark")}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Monthly register — staff × days grid with per-person totals.
// ---------------------------------------------------------------------------

function MonthlyRegister({
  staff,
  staffLoading,
  truncated,
}: {
  staff: Staff[]
  staffLoading: boolean
  truncated: boolean
}) {
  const t = useTranslations("StaffAttendance")
  const tStatus = useTranslations("AttendanceStatus")
  const tCommon = useTranslations("Common")

  const locale = useLocale()
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"))
  const monthStart = parse(`${month}-01`, "yyyy-MM-dd", new Date())
  const monthEnd = endOfMonth(monthStart)
  const from = format(monthStart, "yyyy-MM-dd")
  const to = format(monthEnd, "yyyy-MM-dd")
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const { data: rows, isLoading } = useAttendanceRange(from, to)

  const grid = useMemo(() => {
    const cells = new Map<string, AttendanceStatus>()
    for (const row of rows ?? []) {
      cells.set(`${row.staff_id}:${row.attendance_date}`, row.status)
    }
    return cells
  }, [rows])

  function shiftMonth(delta: number) {
    setMonth(format(addMonths(startOfMonth(monthStart), delta), "yyyy-MM"))
  }

  if (staffLoading) {
    return <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
  }
  if (staff.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noStaff")}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => shiftMonth(-1)}
          aria-label={t("prevMonth")}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="min-w-36 text-center font-medium tabular-nums">
          {/* Intl rather than date-fns format(), which only knows English
              month names without a locale import per language. */}
          {new Intl.DateTimeFormat(locale, {
            month: "long",
            year: "numeric",
          }).format(monthStart)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => shiftMonth(1)}
          aria-label={t("nextMonth")}
        >
          <ChevronRightIcon />
        </Button>
        {isLoading ? (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {truncated ? (
        <p className="text-xs text-muted-foreground">{t("tooManyStaff")}</p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 min-w-40 bg-muted px-3 py-2 text-left font-medium">
                {t("columnStaff")}
              </th>
              {days.map((day) => (
                <th
                  key={day.toISOString()}
                  className={cn(
                    "min-w-7 px-1 py-2 text-center font-medium tabular-nums",
                    isWeekend(day) && "text-muted-foreground"
                  )}
                >
                  {format(day, "d")}
                </th>
              ))}
              {STATUSES.map((status) => (
                <th
                  key={status}
                  className="min-w-8 border-l px-1.5 py-2 text-center font-semibold"
                  title={tStatus(status)}
                >
                  {tStatus(`${status}Short`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((person) => {
              const totals: Record<AttendanceStatus, number> = {
                present: 0,
                absent: 0,
                half_day: 0,
                leave: 0,
              }
              return (
                <tr key={person.id} className="border-t">
                  <td className="sticky left-0 z-10 truncate bg-background px-3 py-1.5 font-medium">
                    {person.name}
                  </td>
                  {days.map((day) => {
                    const status = grid.get(
                      `${person.id}:${format(day, "yyyy-MM-dd")}`
                    )
                    if (status) totals[status] += 1
                    return (
                      <td
                        key={day.toISOString()}
                        className="px-0.5 py-1 text-center"
                      >
                        {status ? (
                          <span
                            className={cn(
                              "inline-flex size-6 items-center justify-center rounded font-semibold",
                              STATUS_TONE[status]
                            )}
                            title={`${format(day, "d MMM")} · ${tStatus(status)}`}
                          >
                            {tStatus(`${status}Short`)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">·</span>
                        )}
                      </td>
                    )
                  })}
                  {STATUSES.map((status) => (
                    <td
                      key={status}
                      className="border-l px-1.5 py-1 text-center font-semibold tabular-nums"
                    >
                      {totals[status]}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
