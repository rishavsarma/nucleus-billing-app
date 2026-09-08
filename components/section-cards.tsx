"use client"

import { useTranslations } from "next-intl"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DollarSignIcon,
  ArrowDownLeftIcon,
  AlertCircleIcon,
  ShoppingBagIcon,
} from "lucide-react"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { Skeleton } from "@/components/ui/skeleton"

const formatMoney = (n: number) =>
  "₹" +
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function SectionCards() {
  const t = useTranslations("DashboardOverview")
  const { data: stats, isLoading } = useDashboardStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="@container/card p-4">
            <Skeleton className="mb-2 h-4 w-28" />
            <Skeleton className="mb-2 h-8 w-36" />
            <Skeleton className="h-3 w-44" />
          </Card>
        ))}
      </div>
    )
  }

  const revenue = stats?.totalRevenue ?? 0
  const collected = stats?.totalCollected ?? 0
  const outstanding = stats?.totalOutstanding ?? 0
  const expenses = stats?.totalExpenses ?? 0

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>{t("totalInvoicedSales")}</CardDescription>
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <DollarSignIcon className="size-4" />
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatMoney(revenue)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <span>
              {t("confirmedInvoicesCount", {
                count: stats?.invoicesCount ?? 0,
              })}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {t("totalSalesDescription")}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>{t("totalCollectedCash")}</CardDescription>
            <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-500">
              <ArrowDownLeftIcon className="size-4" />
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold text-emerald-600 tabular-nums @[250px]/card:text-3xl dark:text-emerald-400">
            {formatMoney(collected)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <span>{t("realizedCollections")}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {t("collectedDescription")}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>{t("outstandingReceivables")}</CardDescription>
            <div className="rounded-md bg-amber-500/10 p-1.5 text-amber-500">
              <AlertCircleIcon className="size-4" />
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold text-amber-600 tabular-nums @[250px]/card:text-3xl dark:text-amber-400">
            {formatMoney(outstanding)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
            <span>{t("pendingBalances")}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {t("outstandingDescription")}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>{t("purchaseBillsExpenses")}</CardDescription>
            <div className="rounded-md bg-indigo-500/10 p-1.5 text-indigo-500">
              <ShoppingBagIcon className="size-4" />
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatMoney(expenses)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium">
            <span>{t("vendorProcurement")}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {t("expensesDescription")}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
