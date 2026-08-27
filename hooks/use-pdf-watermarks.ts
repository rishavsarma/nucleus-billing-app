"use client"

import type { ListParams } from "@/lib/database/list-params-types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchPdfWatermarksAll, fetchPdfWatermarksPaginated,
  createPdfWatermark,
  updatePdfWatermark,
  deletePdfWatermark,
} from "@/lib/database/services/pdf-watermarks"
import type { PdfWatermark } from "@/lib/database/types"

/** All records — use to compute today's active preset client-side. */
export function usePdfWatermarks() {
  return useQuery({
    queryKey: ["pdf-watermarks", "all"],
    queryFn: fetchPdfWatermarksAll,
  })
}

/** Paginated + searched list — use in the settings list-view page. */
export function usePdfWatermarksList(params: ListParams) {
  return useQuery({
    queryKey: ["pdf-watermarks", "list", params],
    queryFn: () => fetchPdfWatermarksPaginated(params),
  })
}

export function useCreatePdfWatermark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<PdfWatermark>) => createPdfWatermark(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pdf-watermarks"] }),
  })
}

export function useUpdatePdfWatermark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PdfWatermark> }) =>
      updatePdfWatermark(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pdf-watermarks"] }),
  })
}

export function useDeletePdfWatermark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePdfWatermark(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pdf-watermarks"] }),
  })
}

/** Today's active preset for this org, or null — most-recently-started
 * wins if date ranges overlap (a data-entry mistake, not a schema
 * concern). Falls back to null so callers can fall back to the flat
 * organizations.pdf_watermark_text field instead. */
export function useActivePdfWatermarkText(): string | null {
  const { data: watermarks } = usePdfWatermarks()
  if (!watermarks?.length) return null
  const today = new Date().toISOString().slice(0, 10)
  const active = watermarks
    .filter((w) => w.is_active && w.starts_on <= today && w.ends_on >= today)
    .sort((a, b) => (a.starts_on < b.starts_on ? 1 : -1))
  return active[0]?.text ?? null
}
