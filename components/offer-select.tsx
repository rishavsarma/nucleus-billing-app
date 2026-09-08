"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Check, ChevronsUpDown, Loader2, Tag, X } from "lucide-react"

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
import { useOffer, useOffersList } from "@/hooks/use-offers"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import type { Offer } from "@/lib/database/types"

export interface OfferSelectProps {
  id?: string
  value?: string | null
  onValueChange?: (value: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  /** Portal target for the dropdown — defaults to document.body. Pass e.g.
   * a fullscreened element's ref so it still renders during Fullscreen. */
  container?: HTMLElement | null
}

/** Offer picker — searches the server as you type instead of fetching
 * every named offer in the org and filtering client-side. A handful of
 * active promotions is common, but nothing stops years of seasonal
 * campaigns piling up, so this follows the same pattern as the other
 * pickers rather than assuming a small, fixed count. */
export function OfferSelect({
  id,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled = false,
  className,
  container,
}: OfferSelectProps) {
  const t = useTranslations("Pickers")
  const resolvedPlaceholder = placeholder ?? t("offerPlaceholder")
  const resolvedSearchPlaceholder =
    searchPlaceholder ?? t("offerSearchPlaceholder")
  const resolvedEmptyMessage = emptyMessage ?? t("offerEmpty")

  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data: selectedOffer } = useOffer(value ?? undefined)
  const { data: result, isLoading } = useOffersList({
    search: debouncedSearch,
    page: 1,
    pageSize: 20,
  })

  const today = new Date().toISOString().slice(0, 10)
  const validOffers = React.useMemo(() => {
    return (result?.data ?? []).filter((o) => {
      if (o.id === value) return true
      if (!o.is_active) return false
      if (o.starts_at && o.starts_at > today) return false
      if (o.ends_at && o.ends_at < today) return false
      return true
    })
  }, [result, value, today])

  const formatOfferBadge = (offer: Offer) => {
    const suffix = t("offerOffSuffix")
    if (offer.discount_type === "percentage") {
      return `${offer.value}% ${suffix}`
    }
    return `₹${offer.value} ${suffix}`
  }

  return (
    <div className="flex w-full items-center gap-1.5">
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
              !selectedOffer && "text-muted-foreground",
              className
            )}
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <Tag className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {selectedOffer ? (
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <span>{selectedOffer.name}</span>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                      {formatOfferBadge(selectedOffer)}
                    </span>
                  </span>
                ) : (
                  resolvedPlaceholder
                )}
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
              ) : validOffers.length === 0 && !selectedOffer ? (
                <CommandEmpty>{resolvedEmptyMessage}</CommandEmpty>
              ) : (
                <CommandGroup>
                  {selectedOffer && (
                    <CommandItem
                      value="__none__"
                      onSelect={() => {
                        onValueChange?.(null)
                        setOpen(false)
                      }}
                      className="flex cursor-pointer items-center justify-between py-2 text-muted-foreground"
                    >
                      <span>{t("offerRemove")}</span>
                      <X className="size-4" />
                    </CommandItem>
                  )}
                  {validOffers.map((offer) => (
                    <CommandItem
                      key={offer.id}
                      value={offer.id}
                      onSelect={(currentValue) => {
                        onValueChange?.(
                          currentValue === value ? null : currentValue
                        )
                        setOpen(false)
                      }}
                      className="flex cursor-pointer items-center justify-between py-2"
                    >
                      <div className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {offer.name}
                          </span>
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                            {formatOfferBadge(offer)}
                          </span>
                        </div>
                        {offer.description && (
                          <span className="truncate text-xs text-muted-foreground">
                            {offer.description}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ms-2 size-4 shrink-0",
                          value === offer.id
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
      {selectedOffer && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onValueChange?.(null)}
          title="Remove offer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
