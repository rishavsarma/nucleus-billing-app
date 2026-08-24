"use client"

import { useEffect, useState } from "react"
import { Loader2Icon } from "lucide-react"

/**
 * Fullscreen cover shown for the brief window between the server-rendered
 * HTML and the client finishing hydration, so a visitor never sees
 * unstyled/mid-transition content — instead this disappears once hydration
 * is done and the real (already-correctly-themed, via ThemePresetScript)
 * app is underneath.
 *
 * Deliberately gated on plain mount state, not on
 * useThemePresetStore.persist's hydration signal: that depends on
 * localStorage succeeding (blocked in some private-browsing modes, some
 * extensions, storage-quota edge cases) and on a promise chain actually
 * resolving. If that signal never fires for any reason, an overlay gated on
 * it would stay stuck forever with nothing able to dismiss it — worse than
 * the flash it was meant to prevent. A mount effect always fires exactly
 * once, unconditionally, so this can't get stuck.
 *
 * Rendered directly in app/layout.tsx, above (outside) the
 * NextIntlClientProvider that app/[locale]/layout.tsx sets up — so, like
 * app/global-error.tsx, it can't use useTranslations (no provider for a
 * client component to read from) and its one label stays hardcoded English.
 */
export function ThemeLoaderOverlay() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Mounting is the event itself, not a signal from an external system to
    // sync from — the usual reason this rule asks for a callback instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  if (mounted) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="fixed inset-0 z-9999 flex items-center justify-center bg-background"
    >
      <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
    </div>
  )
}
