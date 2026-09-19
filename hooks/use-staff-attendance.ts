"use client"

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  deleteAttendance,
  fetchAttendanceRange,
  saveAttendanceDay,
  type AttendanceEntryInput,
} from "@/lib/database/services/staff-attendance"

/** Attendance rows in a date range — one day for the daily sheet, a month
 * for the register. */
export function useAttendanceRange(from: string, to: string) {
  return useQuery({
    queryKey: ["staff-attendance", "range", from, to],
    queryFn: () => fetchAttendanceRange({ from, to }),
    enabled: !!from && !!to,
    placeholderData: keepPreviousData,
  })
}

export function useSaveAttendanceDay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      attendance_date: string
      entries: AttendanceEntryInput[]
    }) => saveAttendanceDay(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["staff-attendance"] }),
  })
}

export function useDeleteAttendance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAttendance(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["staff-attendance"] }),
  })
}
