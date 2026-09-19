import { api } from "@/lib/axios"
import type { AttendanceStatus, StaffAttendance } from "@/lib/database/types"

export type AttendanceEntryInput = {
  staff_id: string
  status: AttendanceStatus
  note?: string | null
}

/** Every attendance row for the org between two YYYY-MM-DD dates, inclusive
 * (at most 62 days apart — the API rejects wider ranges). */
export async function fetchAttendanceRange(params: {
  from: string
  to: string
  staff_id?: string
}): Promise<StaffAttendance[]> {
  const { data } = await api.get<StaffAttendance[]>(
    "/database/staff_attendance",
    {
      params,
    }
  )
  return data
}

/** Saves a whole day's register at once; re-saving a day replaces its marks. */
export async function saveAttendanceDay(input: {
  attendance_date: string
  entries: AttendanceEntryInput[]
}): Promise<StaffAttendance[]> {
  const { data } = await api.post<StaffAttendance[]>(
    "/database/staff_attendance",
    input
  )
  return data
}

export async function deleteAttendance(id: string): Promise<void> {
  await api.delete("/database/staff_attendance", { params: { id } })
}
