"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, type LucideIcon } from "lucide-react"

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

export interface SearchableOption {
  value: string
  label: string | null
  subtitle?: string | null
  keywords?: string[]
}

export interface SearchableSelectProps {
  id?: string
  options: SearchableOption[]
  value?: string | null
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  icon?: LucideIcon
  /** Portal target for the dropdown — defaults to document.body. Pass e.g.
   * a fullscreened element's ref so it still renders during Fullscreen. */
  container?: HTMLElement | null
  /** Controlled search text — when provided (together with onSearchChange),
   * `options` is trusted to already be filtered server-side (e.g. a
   * debounced paginated fetch), and the built-in client-side filter is
   * skipped entirely. Omit both for the original fully-client-side mode
   * (filter every option in `options` locally). */
  search?: string
  onSearchChange?: (search: string) => void
  /** Shows a spinner in place of the list while a server-driven search is
   * in flight. Only meaningful together with search/onSearchChange. */
  isLoading?: boolean
}

export function SearchableSelect({
  id,
  options = [],
  value,
  onValueChange,
  placeholder = "Select an option…",
  searchPlaceholder = "Search…",
  emptyMessage = "No results found.",
  disabled = false,
  className,
  icon: Icon,
  container,
  search,
  onSearchChange,
  isLoading = false,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const isServerSearch = onSearchChange !== undefined

  const selectedOption = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next && isServerSearch) onSearchChange?.("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-9 px-3 text-start",
            !selectedOption && "text-muted-foreground",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
            <span className="truncate">
              {selectedOption ? (selectedOption.label ?? "—") : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-[280px] p-0"
        align="start"
        container={container}
      >
        <Command
          shouldFilter={!isServerSearch}
          filter={
            isServerSearch
              ? undefined
              : (itemValue, search) => {
                  const opt = options.find((o) => o.value === itemValue)
                  if (!opt) return 0
                  const query = search.toLowerCase().trim()
                  const matchLabel = (opt.label ?? "").toLowerCase().includes(query)
                  const matchSub = (opt.subtitle ?? "").toLowerCase().includes(query)
                  const matchKeywords = opt.keywords?.some((k) => k.toLowerCase().includes(query)) ?? false
                  return matchLabel || matchSub || matchKeywords ? 1 : 0
                }
          }
        >
          {isServerSearch ? (
            <CommandInput value={search} onValueChange={onSearchChange} placeholder={searchPlaceholder} />
          ) : (
            <CommandInput placeholder={searchPlaceholder} />
          )}
          <CommandList className="max-h-60">
            {isServerSearch && isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : options.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onValueChange?.(currentValue)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between py-2 cursor-pointer"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{option.label ?? "—"}</span>
                    {option.subtitle && (
                      <span className="text-xs text-muted-foreground truncate">
                        {option.subtitle}
                      </span>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "ms-2 size-4 shrink-0",
                      value === option.value ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
