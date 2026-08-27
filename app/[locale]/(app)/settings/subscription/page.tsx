"use client"

import { useTranslations } from "next-intl"

import { StatusBadge } from "@/components/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentOrganization } from "@/hooks/use-organizations"

const STATUS_LABEL_KEY = {
  trialing: "statusTrialing",
  active: "statusActive",
  past_due: "statusPastDue",
  cancelled: "statusCancelled",
} as const

export default function SubscriptionPage() {
  const t = useTranslations("Subscription")
  const { data: organization, isLoading } = useCurrentOrganization()

  const renewsAt = organization?.subscription_current_period_end
    ? new Date(organization.subscription_current_period_end).toLocaleDateString()
    : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="p-4">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t("currentPlanLabel")}</span>
                {organization ? (
                  <StatusBadge status={organization.subscription_status}>
                    {t(STATUS_LABEL_KEY[organization.subscription_status])}
                  </StatusBadge>
                ) : (
                  <span className="text-sm">{t("notSet")}</span>
                )}
              </div>
              <div className="flex flex-col gap-1 text-right">
                <span className="text-xs text-muted-foreground">
                  {t("renewsOn", { date: renewsAt ?? t("notSet") })}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("whatsIncludedTitle")}</h2>
        </div>
        <ul className="flex flex-col gap-2 p-4 text-sm">
          <li>{t("included1")}</li>
          <li>{t("included2")}</li>
          <li>{t("included3")}</li>
          <li>{t("included4")}</li>
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">{t("noPaymentGatewayNote")}</p>
    </div>
  )
}
