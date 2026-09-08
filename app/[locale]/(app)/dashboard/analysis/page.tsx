"use client"

import { useTranslations } from "next-intl"

import { useDashboardAnalytics } from "@/hooks/use-dashboard-analytics"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUpIcon,
  PercentIcon,
  ShoppingBagIcon,
  UsersIcon,
  CreditCardIcon,
  DollarSignIcon,
  PackageIcon,
} from "lucide-react"

const formatMoney = (n: number) =>
  "₹" +
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default function AnalysisPage() {
  const t = useTranslations("DashboardAnalysis")
  const { data: analytics, isLoading } = useDashboardAnalytics()

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="mb-2 h-4 w-28" />
              <Skeleton className="mb-2 h-8 w-36" />
              <Skeleton className="h-3 w-40" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  const purchases = analytics?.totalPurchases ?? 0
  const netProfit = analytics?.netProfit ?? 0
  const profitMargin = analytics?.profitMargin ?? 0
  const aov = analytics?.aov ?? 0
  const collectionRate = analytics?.collectionRate ?? 0

  const topProducts = analytics?.topProducts ?? []
  const topCustomers = analytics?.topCustomers ?? []
  const paymentMethods = analytics?.paymentMethods ?? []

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>{t("netOperatingMargin")}</CardDescription>
            <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-500">
              <TrendingUpIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatMoney(netProfit)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge
                variant={profitMargin >= 0 ? "default" : "destructive"}
                className="px-1.5 py-0 text-[10px]"
              >
                {t("marginBadge", { percent: profitMargin })}
              </Badge>
              <span>{t("salesVsPurchases")}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>{t("averageOrderValue")}</CardDescription>
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <DollarSignIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatMoney(aov)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("averageOrderValueDescription")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>{t("collectionEfficiency")}</CardDescription>
            <div className="rounded-md bg-indigo-500/10 p-1.5 text-indigo-500">
              <PercentIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {collectionRate}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("collectionEfficiencyDescription")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>{t("procurementSpend")}</CardDescription>
            <div className="rounded-md bg-amber-500/10 p-1.5 text-amber-500">
              <ShoppingBagIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatMoney(purchases)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("procurementSpendDescription")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Products Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <PackageIcon className="size-4 text-primary" />
                  {t("topProductsTitle")}
                </CardTitle>
                <CardDescription>{t("topProductsDescription")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("noProductData")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">
                        {t("columnRank")}
                      </th>
                      <th className="pb-2 text-left font-medium">
                        {t("columnProduct")}
                      </th>
                      <th className="pb-2 text-right font-medium">
                        {t("columnQtySold")}
                      </th>
                      <th className="pb-2 text-right font-medium">
                        {t("columnRevenue")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-muted/40">
                        <td className="py-2.5 font-mono text-xs text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="py-2.5">
                          <p className="font-medium text-foreground">
                            {p.name}
                          </p>
                          {p.sku ? (
                            <p className="text-xs text-muted-foreground">
                              {t("skuPrefix")} {p.sku}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                          {p.quantity}
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums">
                          {formatMoney(p.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Customers Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <UsersIcon className="size-4 text-primary" />
                  {t("topCustomersTitle")}
                </CardTitle>
                <CardDescription>
                  {t("topCustomersDescription")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("noCustomerData")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">
                        {t("columnRank")}
                      </th>
                      <th className="pb-2 text-left font-medium">
                        {t("columnCustomer")}
                      </th>
                      <th className="pb-2 text-right font-medium">
                        {t("columnInvoices")}
                      </th>
                      <th className="pb-2 text-right font-medium">
                        {t("columnTotalSpent")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topCustomers.map((c, idx) => (
                      <tr key={idx} className="hover:bg-muted/40">
                        <td className="py-2.5 font-mono text-xs text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 font-medium text-foreground">
                          {c.name}
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                          {c.invoiceCount}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-primary tabular-nums">
                          {formatMoney(c.totalInvoiced)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <CreditCardIcon className="size-4 text-primary" />
            {t("paymentBreakdownTitle")}
          </CardTitle>
          <CardDescription>{t("paymentBreakdownDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
            {paymentMethods.map((pm) => (
              <div
                key={pm.method}
                className="flex flex-col gap-1 rounded-lg border bg-card/60 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground capitalize">
                    {pm.method.replace("_", " ")}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {pm.percentage}%
                  </Badge>
                </div>
                <div className="text-lg font-bold tabular-nums">
                  {formatMoney(pm.amount)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
