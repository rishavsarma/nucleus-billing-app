import { api } from "@/lib/axios"
import type { PdfWatermark } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch watermark presets, used to compute today's active one client-side.
 * Capped at 20 rather than unbounded (9999) — no search/pagination UI for
 * this yet, so a tenant with more than 20 presets would need that built
 * (tracked separately); 20 is a safety cap, not a claim this table is
 * inherently small. */
export async function fetchPdfWatermarksAll(): Promise<PdfWatermark[]> {
  const { data } = await api.get<PdfWatermark[]>("/database/pdf_watermarks", { params: { page: 1, pageSize: 20 } })
  return (data as unknown as PaginatedResponse<PdfWatermark>).data
}

/** Fetch a paginated + searched page of watermark presets. */
export async function fetchPdfWatermarksPaginated(params: ListParams): Promise<PaginatedResponse<PdfWatermark>> {
  const { data } = await api.get<PaginatedResponse<PdfWatermark>>("/database/pdf_watermarks", { params })
  return data
}

export async function createPdfWatermark(input: Partial<PdfWatermark>): Promise<PdfWatermark> {
  const { data } = await api.post<PdfWatermark>("/database/pdf_watermarks", input)
  return data
}

export async function updatePdfWatermark(id: string, input: Partial<PdfWatermark>): Promise<PdfWatermark> {
  const { data } = await api.put<PdfWatermark>("/database/pdf_watermarks", input, { params: { id } })
  return data
}

export async function deletePdfWatermark(id: string): Promise<void> {
  await api.delete("/database/pdf_watermarks", { params: { id } })
}
