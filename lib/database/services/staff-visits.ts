import { api } from "@/lib/axios"
import type { StaffVisit, StaffVisitStatus } from "@/lib/database/types"
import type {
  ListParams,
  PaginatedResponse,
} from "@/lib/database/list-params-types"

export type StaffVisitListParams = ListParams & {
  staff_id?: string
  status?: StaffVisitStatus
}

export async function fetchStaffVisitsPaginated(
  params: StaffVisitListParams
): Promise<PaginatedResponse<StaffVisit>> {
  const { data } = await api.get<PaginatedResponse<StaffVisit>>(
    "/database/staff_visits",
    { params }
  )
  return data
}

export async function createStaffVisit(
  input: Partial<StaffVisit>
): Promise<StaffVisit> {
  const { data } = await api.post<StaffVisit>("/database/staff_visits", input)
  return data
}

export async function updateStaffVisit(
  id: string,
  input: Partial<StaffVisit>
): Promise<StaffVisit> {
  const { data } = await api.put<StaffVisit>("/database/staff_visits", input, {
    params: { id },
  })
  return data
}

export async function deleteStaffVisit(id: string): Promise<void> {
  await api.delete("/database/staff_visits", { params: { id } })
}
