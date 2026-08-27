"use client"

import * as React from "react"
import { format, parseISO, isValid } from "date-fns"
import { CalendarIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DatePickerProps {
  id?: string
  value?: string | Date | null
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  clearable?: boolean
  /** Portal target for the calendar popover — needed when the picker is
   * rendered inside a native Fullscreen element (e.g. the POS), since
   * Radix's default document.body portal is invisible there. */
  container?: HTMLElement | null
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  clearable = false,
  container,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const dateValue: Date | undefined = React.useMemo(() => {
    if (!value) return undefined
    if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value
    if (typeof value === "string") {
      const parsed = parseISO(value)
      return isValid(parsed) ? parsed : undefined
    }
    return undefined
  }, [value])

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onChange?.(format(selectedDate, "yyyy-MM-dd"))
    } else {
      onChange?.("")
    }
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange?.("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-start font-normal h-9 px-3 gap-2",
            !dateValue && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">
            {dateValue ? format(dateValue, "PPP") : placeholder}
          </span>
          {clearable && dateValue && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="ms-auto rounded-sm p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" container={container}>
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          defaultMonth={dateValue}
        />
      </PopoverContent>
    </Popover>
  )
}
