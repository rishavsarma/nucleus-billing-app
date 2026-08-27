"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Customer } from "@/lib/database/types"

export interface CustomerSelectProps {
  id?: string
  customers?: Customer[]
  value?: string | null
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  /** When provided, renders an "add new customer" row at the bottom of the list, below a separator. */
  onAddNew?: () => void
  addNewLabel?: string
  /** Portal target for the dropdown — defaults to document.body. Pass e.g.
   * a fullscreened element's ref so it still renders during Fullscreen. */
  container?: HTMLElement | null
}

export function CustomerSelect({
  id,
  customers = [],
  value,
  onValueChange,
  placeholder = "Select a customer…",
  searchPlaceholder = "Search customer…",
  emptyMessage = "No customer found.",
  disabled = false,
  className,
  onAddNew,
  addNewLabel = "Add new customer",
  container,
}: CustomerSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedCustomer = React.useMemo(
    () => customers.find((c) => c.id === value),
    [customers, value]
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
            !selectedCustomer && "text-muted-foreground",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <User className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedCustomer ? selectedCustomer.name : placeholder}
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
          filter={(itemValue, search) => {
            if (itemValue === "__add_new_customer__") return 1
            const customer = customers.find((c) => c.id === itemValue)
            if (!customer) return 0
            const query = search.toLowerCase().trim()
            const matchName = customer.name.toLowerCase().includes(query)
            const matchEmail = customer.email?.toLowerCase().includes(query) ?? false
            const matchPhone = customer.phone?.toLowerCase().includes(query) ?? false
            const matchTax = customer.tax_id?.toLowerCase().includes(query) ?? false
            return matchName || matchEmail || matchPhone || matchTax ? 1 : 0
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-60">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.id}
                  onSelect={(currentValue) => {
                    onValueChange?.(currentValue)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between py-2 cursor-pointer"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{customer.name}</span>
                    {(customer.email || customer.phone) && (
                      <span className="text-xs text-muted-foreground truncate">
                        {[customer.email, customer.phone].filter(Boolean).join(" • ")}
                      </span>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "ms-2 size-4 shrink-0",
                      value === customer.id ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            {onAddNew ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__add_new_customer__"
                    onSelect={() => {
                      setOpen(false)
                      onAddNew()
                    }}
                    className="cursor-pointer text-primary"
                  >
                    <Plus className="size-4" />
                    <span>{addNewLabel}</span>
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
