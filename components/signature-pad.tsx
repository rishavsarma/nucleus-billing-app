"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { EraserIcon, UploadIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface SignaturePadHandle {
  /** Empties the canvas — does not itself call onChange; the caller reads
   * isEmpty() (via the ref) or just calls its own clear-state logic after. */
  clear: () => void
  /** Base64 PNG data URL of the current strokes, or null if nothing's
   * been drawn — the shape stored in organizations.signature_image. */
  toDataUrl: () => string | null
  isEmpty: () => boolean
}

interface SignaturePadProps {
  className?: string
  /** Existing signature to show on mount (e.g. the org's saved one) —
   * drawn once as a background image; further strokes draw on top. */
  initialImage?: string | null
}

/**
 * Minimal hand-rolled canvas signature pad — mouse + touch, no external
 * dependency. Deliberately not a controlled/onChange-per-stroke component:
 * callers read the drawn result via the ref (toDataUrl/isEmpty) at their
 * own save point, matching how a "capture, then Save" flow actually works
 * (see the Signature card in settings/organization/page.tsx).
 */
export const SignaturePad = React.forwardRef<
  SignaturePadHandle,
  SignaturePadProps
>(function SignaturePad({ className, initialImage }, ref) {
  const t = useTranslations("Pickers")
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const drawingRef = React.useRef(false)
  const hasStrokesRef = React.useRef(false)
  const lastPointRef = React.useRef<{ x: number; y: number } | null>(null)
  const [uploadError, setUploadError] = React.useState<string | null>(null)

  const getContext = React.useCallback(
    () => canvasRef.current?.getContext("2d") ?? null,
    []
  )

  const clearCanvas = React.useCallback(() => {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasStrokesRef.current = false
  }, [getContext])

  /** Draws an already-loaded image into the canvas "contain"-fit —
   * scaled to fit within the canvas bounds without distortion, centered
   * — same treatment whether the source is a freshly uploaded photo or
   * (via the mount effect below) the previously saved signature. */
  const drawImageFit = React.useCallback(
    (img: HTMLImageElement) => {
      const canvas = canvasRef.current
      const ctx = getContext()
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const scale = Math.min(
        canvas.width / img.width,
        canvas.height / img.height
      )
      const drawWidth = img.width * scale
      const drawHeight = img.height * scale
      const offsetX = (canvas.width - drawWidth) / 2
      const offsetY = (canvas.height - drawHeight) / 2
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
      hasStrokesRef.current = true
    },
    [getContext]
  )

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = "" // allow re-selecting the same file later
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setUploadError(t("signatureUploadError"))
      return
    }
    setUploadError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => drawImageFit(img)
      img.onerror = () => setUploadError(t("signatureUploadError"))
      img.src = reader.result as string
    }
    reader.onerror = () => setUploadError(t("signatureUploadError"))
    reader.readAsDataURL(file)
  }

  React.useImperativeHandle(
    ref,
    () => ({
      clear: clearCanvas,
      toDataUrl: () =>
        hasStrokesRef.current
          ? (canvasRef.current?.toDataURL("image/png") ?? null)
          : null,
      isEmpty: () => !hasStrokesRef.current,
    }),
    [clearCanvas]
  )

  // Draw the existing saved signature (if any) once the canvas mounts —
  // contain-fit, same as a freshly uploaded photo, so a previously
  // uploaded (non-square) photo signature doesn't get distorted on
  // reload the way a stretch-to-fill would.
  React.useEffect(() => {
    if (!initialImage) return
    const img = new Image()
    img.onload = () => drawImageFit(img)
    img.src = initialImage
    // Only on mount — subsequent prop changes (e.g. after Clear) are
    // handled by the parent re-keying this component, not a re-draw here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getPoint(event)
    if (!point) return
    canvasRef.current?.setPointerCapture(event.pointerId)
    drawingRef.current = true
    lastPointRef.current = point
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = getContext()
    const point = getPoint(event)
    const last = lastPointRef.current
    if (!ctx || !point || !last) return
    ctx.strokeStyle = "currentColor"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPointRef.current = point
    hasStrokesRef.current = true
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false
    lastPointRef.current = null
    canvasRef.current?.releasePointerCapture(event.pointerId)
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <canvas
        ref={canvasRef}
        width={480}
        height={160}
        className="w-full touch-none rounded-lg border bg-background text-foreground"
        style={{ height: "160px" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearCanvas}
          className="gap-1.5"
        >
          <EraserIcon className="size-3.5" />
          {t("signatureClear")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-1.5"
        >
          <UploadIcon className="size-3.5" />
          {t("signatureUpload")}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {uploadError ? (
          <span className="text-xs text-destructive">{uploadError}</span>
        ) : null}
      </div>
    </div>
  )
})
