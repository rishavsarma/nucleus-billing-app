"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, UserRoundIcon } from "lucide-react"

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
import { useStaffList, useStaffMember } from "@/hooks/use-staff"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

export interface StaffSelectProps {
  id?: string
  value?: string | null
  onValueChange?: (value: string) => void
  /** Scopes the picker to one staff role (e.g. "delivery_person"). */
  role?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  /** Portal target for the dropdown — defaults to document.body. Pass e.g.
   * a fullscreened element's ref so it still renders during Fullscreen. */
  container?: HTMLElement | null
}

/** Staff picker (e.g. delivery persons) — searches the server as you type
 * instead of fetching every staff row in the org and filtering client-side.
 * A small headcount is common but not guaranteed, especially for a
 * distributed business with drivers/movers across many locations. */
export function StaffSelect({
  id,
  value,
  onValueChange,
  role,
  placeholder = "Select a staff member…",
  searchPlaceholder = "Search staff…",
  emptyMessage = "No staff found.",
  disabled = false,
  className,
  container,
}: StaffSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data: selectedStaff } = useStaffMember(value ?? undefined)
  const { data: result, isLoading } = useStaffList({ search: debouncedSearch, page: 1, pageSize: 20, role })
  const staff = (result?.data ?? []).filter((person) => person.is_active)

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
            !selectedStaff && "text-muted-foreground",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <UserRoundIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedStaff ? selectedStaff.name : placeholder}
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
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList className="max-h-60">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : staff.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
              <CommandGroup>
                {staff.map((person) => (
                  <CommandItem
                    key={person.id}
                    value={person.id}
                    onSelect={(currentValue) => {
                      onValueChange?.(currentValue)
                      setOpen(false)
                    }}
                    className="flex items-center justify-between py-2 cursor-pointer"
                  >
                    <span className="truncate font-medium">{person.name}</span>
                    <Check
                      className={cn(
                        "ms-2 size-4 shrink-0",
                        value === person.id ? "opacity-100 text-primary" : "opacity-0"
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
