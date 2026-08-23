"use client"

import { useEffect } from "react"
import { loadGoogleFont } from "@/lib/google-fonts"
import { THEME_PRESET_CSS, THEME_PRESET_FONTS } from "@/lib/theme-presets"
import { useThemePresetStore } from "@/store/theme-preset-store"

const STYLE_TAG_ID = "theme-preset-override"

/**
 * Keeps the injected `<style id="theme-preset-override">` tag (created
 * pre-hydration by ThemePresetScript) in sync with the store — both on
 * mount (covers hydration mismatches / first-ever visit with nothing in
 * localStorage yet) and on every live preset change.
 */
export function useThemePreset() {
  const preset = useThemePresetStore((s) => s.preset)
  const setPreset = useThemePresetStore((s) => s.setPreset)

  useEffect(() => {
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
