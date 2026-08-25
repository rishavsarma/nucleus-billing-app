"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useMe } from "@/hooks/use-me"

const EXPIRING_SOON_DAYS = 7

/**
 * Members of a suspended (is_active = false) or lapsed (subscription_status
 * past_due/cancelled) org can't read their own org row through the normal
 * client — organizations_select's RLS policy requires both to be healthy —
 * so every org-scoped list in the app would otherwise just render empty
 * with no explanation. useMe() resolves org status via the service-role
 * admin client specifically to make this state visible.
 *
 * Dismissal lasts for the lifetime of this mounted (app) layout — it
 * reappears on the next full page load/sign-in, which is deliberate: this
 * is important enough to bear repeating rather than being silenced forever
 * by one localStorage write.
 */
export function SubscriptionStatusDialog() {
  const t = useTranslations("SubscriptionAlert")
  const { data: me } = useMe()
  const [dismissed, setDismissed] = useState(false)

  const orgStatus = me?.orgStatus
  if (!orgStatus || dismissed) return null

  const isExpired =
    !orgStatus.isActive || orgStatus.subscriptionStatus === "past_due" || orgStatus.subscriptionStatus === "cancelled"

  // eslint-disable-next-line react-hooks/purity -- "days until expiry" inherently needs the current time; a render evaluated a moment apart is not a correctness issue for a 7-day window.
  const now = Date.now()
  const daysUntilPeriodEnd = orgStatus.subscriptionCurrentPeriodEnd
    ? Math.ceil((new Date(orgStatus.subscriptionCurrentPeriodEnd).getTime() - now) / (1000 * 60 * 60 * 24))
    : null

  const isExpiringSoon =
    !isExpired && daysUntilPeriodEnd !== null && daysUntilPeriodEnd >= 0 && daysUntilPeriodEnd <= EXPIRING_SOON_DAYS

  if (!isExpired && !isExpiringSoon) return null

  const expiredDescriptionKey = !orgStatus.isActive
    ? "expiredDescriptionInactive"
    : orgStatus.subscriptionStatus === "cancelled"
      ? "expiredDescriptionCancelled"
      : "expiredDescriptionPastDue"

  return (
    <Dialog open onOpenChange={(open) => !open && setDismissed(true)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isExpired ? t("expiredTitle") : t("expiringTitle")}</DialogTitle>
          <DialogDescription>
            {isExpired
              ? t(expiredDescriptionKey)
              : t("expiringDescription", {
                  date: orgStatus.subscriptionCurrentPeriodEnd
                    ? new Date(orgStatus.subscriptionCurrentPeriodEnd).toLocaleDateString()
                    : "",
                })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{t("contactNote")}</p>
        <DialogFooter>
          <Button onClick={() => setDismissed(true)}>{t("dismiss")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
