/**
 * Named color presets layered on top of the app's existing light/dark mode
 * (handled by next-themes via the `.dark` class). Same mechanism tweakcn
 * itself uses: each preset is a full CSS custom-property override for
 * `:root` and `.dark`, generated once and applied at runtime — see
 * components/theme-preset-script.tsx (pre-hydration, avoids a flash of the
 * wrong preset) and hooks/use-theme-preset.ts (live switching).
 *
 * Every preset is ported verbatim from tweakcn's built-in library — see
 * lib/theme-preset-data.ts.
 */

import { THEME_PRESET_DATA } from "@/lib/theme-preset-data"

export type ThemePresetId = keyof typeof THEME_PRESET_DATA

export const DEFAULT_THEME_PRESET: ThemePresetId = "violet-bloom"

export const THEME_PRESETS: { id: ThemePresetId; label: string; swatch: string }[] = Object.entries(
  THEME_PRESET_DATA,
).map(([id, preset]) => ({
  id: id as ThemePresetId,
  label: preset.label,
  swatch: preset.light.primary,
}))

function toCssBlock(selector: string, vars: Record<string, string>): string {
  const body = Object.entries(vars)
    .map(([key, value]) => `--${key}:${value};`)
    .join("")
  return `${selector}{${body}}`
}

/** Full `:root{...}.dark{...}` override text for a preset. */
export function getPresetCss(id: ThemePresetId): string {
  const preset = THEME_PRESET_DATA[id]
  return toCssBlock(":root", preset.light) + toCssBlock(".dark", preset.dark)
}

/** Precomputed for every preset — embedded into the pre-hydration script. */
export const THEME_PRESET_CSS: Record<ThemePresetId, string> = Object.fromEntries(
  THEME_PRESETS.map((p) => [p.id, getPresetCss(p.id)]),
) as Record<ThemePresetId, string>

/** Google Font families each preset needs loaded. */
export const THEME_PRESET_FONTS: Record<ThemePresetId, string[]> = Object.fromEntries(
  THEME_PRESETS.map((p) => [p.id, THEME_PRESET_DATA[p.id].fonts]),
) as Record<ThemePresetId, string[]>
