"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Palette } from "lucide-react"

import { useThemePreset } from "@/hooks/use-theme-preset"
import { THEME_PRESETS, type ThemePresetId } from "@/lib/theme-presets"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function ThemePresetSelector() {
  const { preset, setPreset } = useThemePreset()
  const [open, setOpen] = React.useState(false)

  const current = THEME_PRESETS.find((p) => p.id === preset)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-40 justify-between"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Palette className="size-4 shrink-0" />
            <span className="truncate">{current?.label ?? "Theme"}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search themes..." />
          <CommandList>
            <CommandEmpty>No theme found.</CommandEmpty>
            <CommandGroup>
              {THEME_PRESETS.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.label}
                  onSelect={() => {
                    setPreset(p.id as ThemePresetId)
                    setOpen(false)
                  }}
                >
                  <span
                    className="inline-block size-3 shrink-0 rounded-full border"
                    style={{ backgroundColor: p.swatch }}
                  />
                  <span className="truncate">{p.label}</span>
                  <Check
                    className={cn("ml-auto size-4", preset === p.id ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
