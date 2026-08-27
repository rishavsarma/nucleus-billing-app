"use client"

import { useState } from "react"
import { SearchIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useItemsList } from "@/hooks/use-items"
import { useCreateOfferItem, useDeleteOfferItem, useOfferItems } from "@/hooks/use-offer-items"

/** Lets the user check/uncheck which items an offer applies to. Each toggle
 * writes immediately (no separate save step) since offer_items has no
 * columns beyond the (offer_id, item_id) key — there's nothing to batch.
 * Searches the server instead of fetching the entire catalog (pageSize:
 * 9999) — a checked item that scrolls out of the current search page stays
 * checked either way, it's just not shown until searched back into view. */
export function OfferItemPicker({ offerId }: { offerId: string }) {
  const t = useTranslations("Offers")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 300)
  const { data: itemsResult, isFetching } = useItemsList({ search: debouncedSearch, page: 1, pageSize: 50 })
  const items = itemsResult?.data ?? []
  const { data: offerItems } = useOfferItems(offerId)
  const createOfferItem = useCreateOfferItem()
  const deleteOfferItem = useDeleteOfferItem(offerId)

  const selectedIds = new Set(offerItems?.map((oi) => oi.item_id))

  function toggle(itemId: string, checked: boolean) {
    if (checked) {
      createOfferItem.mutate({ offer_id: offerId, item_id: itemId })
    } else {
      deleteOfferItem.mutate(itemId)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 start-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("searchItemsPlaceholder")}
          className="ps-8"
        />
      </div>
      <div className="flex max-h-64 flex-col gap-1 overflow-auto rounded-lg border p-2">
        {isFetching ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("loadingItems")}</p>
        ) : items.length ? (
          items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <Checkbox
                checked={selectedIds.has(item.id)}
                onCheckedChange={(checked) => toggle(item.id, !!checked)}
              />
              <span>{item.name}</span>
              {item.sku ? <span className="text-xs text-muted-foreground">{item.sku}</span> : null}
            </label>
          ))
        ) : (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("noItemsToPick")}</p>
        )}
      </div>
    </div>
  )
}
