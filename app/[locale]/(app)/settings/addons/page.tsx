"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Loader2Icon, PackageIcon } from "lucide-react"

import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAddons } from "@/hooks/use-addons"
import { useMe } from "@/hooks/use-me"
import {
  useCancelAddon,
  useOrganizationAddonSubscriptions,
  useSubscribeToAddon,
} from "@/hooks/use-organization-addon-subscriptions"
import type { Addon } from "@/lib/database/types"

export default function AddonsPage() {
  const t = useTranslations("Addons")
  const tCommon = useTranslations("Common")
  const { data: addons, isLoading: addonsLoading } = useAddons()
  const { data: subscriptions, isLoading: subscriptionsLoading } = useOrganizationAddonSubscriptions()
  const { data: me } = useMe()
  const subscribeToAddon = useSubscribeToAddon()
  const cancelAddon = useCancelAddon()

  const [toCancel, setToCancel] = useState<Addon | null>(null)

  const canManage = !!me?.isSuperadmin && !!me?.orgId
  const isLoading = addonsLoading || subscriptionsLoading

  function subscriptionFor(addonId: string) {
    return subscriptions?.find((sub) => sub.addon_id === addonId)
  }

  function handleSubscribe(addon: Addon) {
    if (!me?.orgId) return
    subscribeToAddon.mutate(
      { org_id: me.orgId, addon_slug: addon.slug },
      {
        onSuccess: () => toast.success(tCommon("updatedSuccess")),
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  function handleCancel(addon: Addon) {
    if (!me?.orgId) return
    cancelAddon.mutate(
      { org_id: me.orgId, addon_slug: addon.slug },
      {
        onSuccess: () => {
          toast.success(tCommon("updatedSuccess"))
          setToCancel(null)
        },
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <p className="text-xs text-muted-foreground">
        {canManage ? t("superadminOnlyNote") : t("notSuperadminNote")}
      </p>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : addons?.length ? (
        <div className="grid grid-cols-3 gap-4">
          {addons.map((addon) => {
            const subscription = subscriptionFor(addon.id)
            const isActive = subscription?.status === "active"
            const isMutating = subscribeToAddon.isPending || cancelAddon.isPending

            return (
              <div key={addon.id} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    <PackageIcon className="size-4.5 text-muted-foreground" />
                  </div>
                  {subscription ? (
                    <StatusBadge status={subscription.status}>
                      {subscription.status === "active" ? t("statusActive") : t("statusCancelled")}
                    </StatusBadge>
                  ) : null}
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{addon.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{addon.description}</p>
                </div>
                <div className="text-sm font-medium">
                  {addon.price > 0 ? (
                    <>
                      ₹{addon.price}
                      <span className="text-xs font-normal text-muted-foreground">{t("perMonth")}</span>
                    </>
                  ) : (
                    t("free")
                  )}
                </div>

                {canManage ? (
                  isActive ? (
                    <Button variant="outline" size="sm" onClick={() => setToCancel(addon)}>
                      {t("cancel")}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => handleSubscribe(addon)} disabled={isMutating}>
                      {isMutating ? <Loader2Icon className="animate-spin" /> : null}
                      {subscription ? t("resubscribe") : t("subscribe")}
                    </Button>
                  )
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noAddons")}</p>
      )}

      <DeleteConfirmDialog
        open={!!toCancel}
        onOpenChange={(open) => !open && setToCancel(null)}
        isDeleting={cancelAddon.isPending}
        title={t("cancelConfirmTitle")}
        description={t("cancelConfirmDescription")}
        onConfirm={() => toCancel && handleCancel(toCancel)}
      />
    </div>
  )
}
