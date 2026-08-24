"use client"

import { useEffect, useRef } from "react"
import { loadGoogleFont } from "@/lib/google-fonts"
import { THEME_PRESET_CSS, THEME_PRESET_FONTS } from "@/lib/theme-presets"
import { useThemePresetStore } from "@/store/theme-preset-store"

const STYLE_TAG_ID = "theme-preset-override"

/**
 * Keeps the injected `<style id="theme-preset-override">` tag (created
 * pre-hydration by ThemePresetScript) in sync with the store on every live
 * preset change.
 *
 * Skips its very first invocation. On mount, `preset` may still read back as
 * the in-memory default even for a returning visitor with a saved preset —
 * zustand's `persist` middleware rehydrates from localStorage
 * asynchronously, so there's a brief window before the store catches up.
 * Writing at that point would clobber the correct CSS ThemePresetScript
 * already painted pre-hydration with the default, producing a visible flash
 * to the real preset a moment later. Since ThemePresetScript guarantees the
 * DOM is already correct by the time anything here mounts, this effect only
 * needs to react to *changes* from that point on — the first run (mount) is
 * never itself a change worth applying, so skipping it is always safe, and
 * unlike gating on the store's own hydration signal, it can't get stuck: a
 * real preset change later always makes `preset` differ from its initial
 * value, so the effect is guaranteed to run for real once, and every time
 * after.
 */
export function useThemePreset() {
  const preset = useThemePresetStore((s) => s.preset)
  const setPreset = useThemePresetStore((s) => s.setPreset)
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }

    let style = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement("style")
      style.id = STYLE_TAG_ID
      document.head.appendChild(style)
    }
    style.textContent = THEME_PRESET_CSS[preset] ?? ""

    for (const family of THEME_PRESET_FONTS[preset] ?? []) {
      loadGoogleFont(family)
    }
  }, [preset])

  return { preset, setPreset }
}
