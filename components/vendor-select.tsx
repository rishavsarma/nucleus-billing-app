"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Building2 } from "lucide-react"

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
import type { Vendor } from "@/lib/database/types"

export interface VendorSelectProps {
  id?: string
  vendors?: Vendor[]
  value?: string | null
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

export function VendorSelect({
  id,
  vendors = [],
  value,
  onValueChange,
  placeholder = "Select a vendor…",
  searchPlaceholder = "Search vendor…",
  emptyMessage = "No vendor found.",
  disabled = false,
  className,
}: VendorSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedVendor = React.useMemo(
    () => vendors.find((v) => v.id === value),
    [vendors, value]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
            !selectedVendor && "text-muted-foreground",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedVendor ? selectedVendor.name : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-[280px] p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) => {
            const vendor = vendors.find((v) => v.id === itemValue)
            if (!vendor) return 0
            const query = search.toLowerCase().trim()
            const matchName = vendor.name.toLowerCase().includes(query)
            const matchEmail = vendor.email?.toLowerCase().includes(query) ?? false
            const matchPhone = vendor.phone?.toLowerCase().includes(query) ?? false
            const matchTax = vendor.tax_id?.toLowerCase().includes(query) ?? false
            return matchName || matchEmail || matchPhone || matchTax ? 1 : 0
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-60">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {vendors.map((vendor) => (
                <CommandItem
                  key={vendor.id}
                  value={vendor.id}
                  onSelect={(currentValue) => {
                    onValueChange?.(currentValue)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between py-2 cursor-pointer"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{vendor.name}</span>
                    {(vendor.email || vendor.phone) && (
                      <span className="text-xs text-muted-foreground truncate">
                        {[vendor.email, vendor.phone].filter(Boolean).join(" • ")}
                      </span>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "ms-2 size-4 shrink-0",
                      value === vendor.id ? "opacity-100 text-primary" : "opacity-0"
                    )}
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
