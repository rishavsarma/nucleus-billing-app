"use client"

import { useTranslations } from "next-intl"

import { Checkbox } from "@/components/ui/checkbox"
import { useItems } from "@/hooks/use-items"
import { useCreateOfferItem, useDeleteOfferItem, useOfferItems } from "@/hooks/use-offer-items"

/** Lets the user check/uncheck which items an offer applies to. Each toggle
 * writes immediately (no separate save step) since offer_items has no
 * columns beyond the (offer_id, item_id) key — there's nothing to batch. */
export function OfferItemPicker({ offerId }: { offerId: string }) {
  const t = useTranslations("Offers")
  const { data: items } = useItems()
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
    <div className="flex max-h-64 flex-col gap-1 overflow-auto rounded-lg border p-2">
      {items?.length ? (
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
  )
}
