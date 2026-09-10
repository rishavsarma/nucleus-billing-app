"use client"

import * as React from "react"
import { DownloadIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Shows a rendered PDF in an iframe, with a Download button.
 *
 * Shared by the invoice and purchase-bill detail pages so both documents get
 * the same preview. The caller renders the PDF and passes an object URL —
 * this component never renders one itself, because the two callers already
 * own the (differently-shaped) element-building code.
 *
 * Object-URL ownership: the URL is created by the caller but revoked *here*,
 * in a cleanup effect keyed on the URL. That keeps the lifetime tied to what
 * is actually on screen — a preview that's replaced or closed frees its blob
 * immediately instead of pinning a multi-MB PDF in memory for the life of the
 * page. Callers must therefore not revoke it themselves.
 */
export function PdfPreviewDialog({
  open,
  onOpenChange,
  url,
  title,
  description,
  loading = false,
  onDownload,
  downloading = false,
  loadingLabel,
  downloadLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Object URL of the rendered PDF, or null while it's still rendering. */
  url: string | null
  title: string
  description?: string
  loading?: boolean
  onDownload?: () => void
  downloading?: boolean
  /** Supplied by the caller from its own message namespace — the dialog is
   * shared between invoices and purchase bills, so it must not reach into
   * one document's namespace for the other's copy. */
  loadingLabel: string
  downloadLabel: string
}) {

  React.useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[calc(100vw-2rem)] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="bg-muted flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border">
          {loading || !url ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
              <Loader2Icon className="size-5 animate-spin" />
              {loadingLabel}
            </div>
          ) : (
            <iframe
              src={url}
              title={title}
              className="h-full w-full"
              // Deliberately not sandboxed: a restrictive `sandbox` blocks the
              // browser's built-in PDF viewer and the frame renders blank. The
              // source is a blob this app generated itself, never user HTML.
            />
          )}
        </div>

        <DialogFooter>
          {onDownload ? (
            <Button
              type="button"
              onClick={onDownload}
              disabled={downloading || loading || !url}
              className="gap-1.5"
            >
              {downloading ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              {downloadLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
