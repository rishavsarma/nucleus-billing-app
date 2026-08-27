"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Warehouse as WarehouseIcon, XIcon } from "lucide-react"

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
import { useWarehouse, useWarehousesList } from "@/hooks/use-warehouses"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

export interface WarehouseSelectProps {
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
  /** Shows a small clear (×) affordance on the trigger once a value is
   * selected — for forms where the warehouse is optional. */
  clearable?: boolean
  onClear?: () => void
}

/** Warehouse picker — searches the server as you type instead of fetching
 * every warehouse in the org and filtering client-side. A single location
 * or two is common, but nothing stops a multi-location chain from having
 * hundreds, so this follows the same pattern as CustomerSelect/VendorSelect
 * rather than assuming a small, fixed count. */
export function WarehouseSelect({
  id,
  value,
  onValueChange,
  placeholder = "Select a warehouse…",
  searchPlaceholder = "Search warehouse…",
  emptyMessage = "No warehouse found.",
  disabled = false,
  className,
  container,
  clearable = false,
  onClear,
}: WarehouseSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data: selectedWarehouse } = useWarehouse(value ?? undefined)
  const { data: result, isLoading } = useWarehousesList({ search: debouncedSearch, page: 1, pageSize: 20 })
  const warehouses = result?.data ?? []

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
            "w-full justify-between font-normal h-9 px-3 text-start",
            !selectedWarehouse && "text-muted-foreground",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <WarehouseIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedWarehouse ? selectedWarehouse.name : placeholder}
            </span>
          </span>
          {clearable && selectedWarehouse && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation()
                onClear?.()
              }}
              className="ms-auto rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </span>
          ) : (
            <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-[280px] p-0"
        align="start"
        container={container}
      >
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList className="max-h-60">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : warehouses.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
              <CommandGroup>
                {warehouses.map((warehouse) => (
                  <CommandItem
                    key={warehouse.id}
                    value={warehouse.id}
                    onSelect={(currentValue) => {
                      onValueChange?.(currentValue)
                      setOpen(false)
                    }}
                    className="flex items-center justify-between py-2 cursor-pointer"
                  >
                    <span className="truncate font-medium">{warehouse.name}</span>
                    <Check
                      className={cn(
                        "ms-2 size-4 shrink-0",
                        value === warehouse.id ? "opacity-100 text-primary" : "opacity-0"
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
