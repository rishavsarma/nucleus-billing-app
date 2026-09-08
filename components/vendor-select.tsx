"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react"

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useVendor, useVendorsList } from "@/hooks/use-vendors"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

export interface VendorSelectProps {
  id?: string
  value?: string | null
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  /** Portal target for the dropdown — defaults to document.body. Pass e.g.
   * a fullscreened element's ref so it still renders during Fullscreen. */
  container?: HTMLElement | null
}

/** Vendor picker — searches the server as you type instead of filtering a
 * pre-loaded list, so it works the same whether the org has 10 vendors or
 * 10,000 (a client-side-filtered full fetch caps out and silently drops
 * anything past the page size). The trigger button resolves the selected
 * vendor's name via a single-row fetch, independent of whatever's currently
 * in the search results. */
export function VendorSelect({
  id,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled = false,
  className,
  container,
}: VendorSelectProps) {
  const t = useTranslations("Pickers")
  const resolvedPlaceholder = placeholder ?? t("vendorPlaceholder")
  const resolvedSearchPlaceholder =
    searchPlaceholder ?? t("vendorSearchPlaceholder")
  const resolvedEmptyMessage = emptyMessage ?? t("vendorEmpty")

  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data: selectedVendor } = useVendor(value ?? undefined)
  const { data: result, isLoading } = useVendorsList({
    search: debouncedSearch,
    page: 1,
    pageSize: 20,
  })
  const vendors = result?.data ?? []

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch("")
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
            "h-9 w-full justify-between px-3 text-start font-normal",
            !selectedVendor && "text-muted-foreground",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedVendor ? selectedVendor.name : resolvedPlaceholder}
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
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={resolvedSearchPlaceholder}
          />
          <CommandList className="max-h-60">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : vendors.length === 0 ? (
              <CommandEmpty>{resolvedEmptyMessage}</CommandEmpty>
            ) : (
              <CommandGroup>
                {vendors.map((vendor) => (
                  <CommandItem
                    key={vendor.id}
                    value={vendor.id}
                    onSelect={(currentValue) => {
                      onValueChange?.(currentValue)
                      setOpen(false)
                    }}
                    className="flex cursor-pointer items-center justify-between py-2"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {vendor.name}
                      </span>
                      {(vendor.email || vendor.phone) && (
                        <span className="truncate text-xs text-muted-foreground">
                          {[vendor.email, vendor.phone]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                      )}
                    </div>
                    <Check
                      className={cn(
                        "ms-2 size-4 shrink-0",
                        value === vendor.id
                          ? "text-primary opacity-100"
                          : "opacity-0"
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
