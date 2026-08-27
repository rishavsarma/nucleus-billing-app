import { api } from "@/lib/axios"
import type { PdfWatermark } from "@/lib/database/types"
import type { ListParams, PaginatedResponse } from "@/lib/database/list-params-types"

/** Fetch all watermark presets with no pagination — small lookup table, used to compute today's active one client-side. */
export async function fetchPdfWatermarksAll(): Promise<PdfWatermark[]> {
  const { data } = await api.get<PdfWatermark[]>("/database/pdf_watermarks", { params: { page: 1, pageSize: 9999 } })
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
