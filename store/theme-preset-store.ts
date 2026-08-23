import { create } from "zustand"
import { persist } from "zustand/middleware"
import { DEFAULT_THEME_PRESET, type ThemePresetId } from "@/lib/theme-presets"

type ThemePresetStore = {
  preset: ThemePresetId
  setPreset: (preset: ThemePresetId) => void
}

export const THEME_PRESET_STORAGE_KEY = "theme-preset-storage"

export const useThemePresetStore = create<ThemePresetStore>()(
  persist(
    (set) => ({
      preset: DEFAULT_THEME_PRESET,
      setPreset: (preset) => set({ preset }),
    }),
    { name: THEME_PRESET_STORAGE_KEY },
  ),
)
