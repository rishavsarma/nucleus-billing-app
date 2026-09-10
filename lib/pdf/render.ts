"use client"

/**
 * Shared client-side PDF render + delivery helpers, used by both the invoice
 * and purchase-bill PDFs so the two can never drift apart.
 *
 * `@formepdf/core` is imported by its explicit `/browser` subpath (rather than
 * relying on the bundler picking the "browser" export condition) so this always
 * resolves to the WASM build that runs client-side, and is dynamically imported
 * so the ~2.6 MB (brotli) WASM binary only downloads the first time a PDF is
 * actually produced — not on every visit to a page that merely has a
 * Preview/Download button.
 */
export async function renderPdfBlob(element: React.ReactElement): Promise<Blob> {
  const { renderDocument } = await import("@formepdf/core/browser")
  const bytes = await renderDocument(element)
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" })
}

/** Renders and triggers a browser download. */
export async function downloadPdf(element: React.ReactElement, filename: string) {
  const blob = await renderPdfBlob(element)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Renders to an object URL for in-app preview. The caller owns the URL and
 * MUST call `URL.revokeObjectURL` when the preview closes — otherwise the
 * blob (and the whole rendered PDF) is pinned in memory for the life of the
 * document. PdfPreviewDialog does this in its cleanup effect.
 */
export async function renderPdfObjectUrl(element: React.ReactElement): Promise<string> {
  const blob = await renderPdfBlob(element)
  return URL.createObjectURL(blob)
}
