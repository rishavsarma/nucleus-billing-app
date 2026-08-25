import { api } from "@/lib/axios"
import type { Superadmin } from "@/lib/database/types"

export type EnrichedSuperadmin = Superadmin & { email: string | null }

export async function fetchEnrichedSuperadmins(): Promise<EnrichedSuperadmin[]> {
  const { data } = await api.get<EnrichedSuperadmin[]>("/superadmins-enriched")
  return data
}
