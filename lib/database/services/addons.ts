import { api } from "@/lib/axios"
import type { Addon } from "@/lib/database/types"

export async function fetchAddons(): Promise<Addon[]> {
  const { data } = await api.get<Addon[]>("/database/addons")
  return data
}
