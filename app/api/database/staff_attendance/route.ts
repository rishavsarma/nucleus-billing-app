import { NextResponse } from "next/server"
import { z } from "zod"
import { pickAllowed } from "@/lib/database/allowed-fields"
import {
  authError,
  badRequest,
  dbError,
  notFound,
  readJson,
} from "@/lib/api-response"
import { requireOrgId } from "@/lib/database/require-org"

// Attendance is read as a date range (a day for the daily sheet, a month for
// the register) and written as a whole day at once, so this route doesn't use
// the paginated list / Redis list-version pattern the catalog routes do: the
// key space would be every (from, to) pair, and every save would bust it.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** A month is at most 31 days; a little headroom for a week-spanning view. */
const MAX_RANGE_DAYS = 62
const MAX_ENTRIES = 500

const bulkSchema = z.object({
  attendance_date: z.string().regex(ISO_DATE),
  entries: z
    .array(
      z.object({
        staff_id: z.uuid(),
        status: z.enum(["present", "absent", "half_day", "leave"]),
        note: z.string().max(500).nullish(),
      })
    )
    .min(1)
    .max(MAX_ENTRIES),
})

function daysBetween(from: string, to: string) {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000
}

export async function GET(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) return authError(auth.error)

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""
  const staffId = searchParams.get("staff_id")

  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return badRequest(
      "invalid_range",
      '"from" and "to" must be YYYY-MM-DD dates.'
    )
  }
  const span = daysBetween(from, to)
  if (!Number.isFinite(span) || span < 0 || span > MAX_RANGE_DAYS) {
    return badRequest(
      "invalid_range",
      `"to" must be on or after "from", at most ${MAX_RANGE_DAYS} days apart.`
    )
  }

  let query = auth.supabase
    .schema("billing")
    .from("staff_attendance")
    .select("*")
    .gte("attendance_date", from)
    .lte("attendance_date", to)
    .order("attendance_date", { ascending: true })
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  if (staffId) query = query.eq("staff_id", staffId)

  const { data, error } = await query
  if (error) return dbError(error, "staff_attendance:GET")
  return NextResponse.json(data ?? [])
}

/**
 * Saves a whole day's register in one request: upserts one row per staff
 * member for `attendance_date`. Re-saving the same day replaces earlier marks
 * (unique on staff_id + attendance_date) instead of duplicating them.
 */
export async function POST(request: Request) {
  const auth = await requireOrgId()
  if (auth.error) return authError(auth.error)

  const body = await readJson(request)
  if (!body)
    return badRequest("invalid_json", "Request body must be valid JSON.")

  const orgId = auth.isSuperadmin ? body.org_id : auth.orgId
  if (!orgId) return badRequest("missing_org_id", '"org_id" is required')

  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest("invalid_attendance", "Attendance entries are invalid.")
  }
  const { attendance_date, entries } = parsed.data

  const staffIds = [...new Set(entries.map((e) => e.staff_id))]
  if (staffIds.length !== entries.length) {
    return badRequest(
      "duplicate_staff",
      "Each staff member can appear only once per day."
    )
  }

  // Every staff_id must belong to this org — one query for the whole batch
  // rather than a verifyBelongsToOrg per row. guard_staff_record_refs() in
  // the database enforces the same thing if this is ever bypassed.
  const { data: owned, error: ownedError } = await auth.supabase
    .schema("billing")
    .from("staff")
    .select("id")
    .eq("org_id", orgId)
    .in("id", staffIds)
  if (ownedError) return dbError(ownedError, "staff_attendance:POST")
  if ((owned?.length ?? 0) !== staffIds.length) {
    return badRequest(
      "invalid_staff_id",
      "One or more staff do not belong to this org."
    )
  }

  const rows = entries.map((entry) => ({
    ...pickAllowed("staff_attendance", { ...entry, attendance_date }),
    org_id: orgId,
    recorded_by: auth.userId,
  }))

  const { data, error } = await auth.supabase
    .schema("billing")
    .from("staff_attendance")
    .upsert(rows, { onConflict: "staff_id,attendance_date" })
    .select()

  if (error) return dbError(error, "staff_attendance:POST")
  return NextResponse.json(data ?? [], { status: 200 })
}

/** Clears a single mark (the day goes back to "not recorded"). */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return badRequest("missing_id", 'Query param "id" is required')

  const auth = await requireOrgId()
  if (auth.error) return authError(auth.error)

  let query = auth.supabase
    .schema("billing")
    .from("staff_attendance")
    .delete()
    .eq("id", id)
  if (!auth.isSuperadmin) query = query.eq("org_id", auth.orgId)
  const { data, error } = await query.select("id").maybeSingle()

  if (error) return dbError(error, "staff_attendance:DELETE")
  if (!data) return notFound()
  return new NextResponse(null, { status: 204 })
}
