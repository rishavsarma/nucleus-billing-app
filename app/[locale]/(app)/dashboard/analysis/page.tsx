"use client"

import { useDashboardAnalytics } from "@/hooks/use-dashboard-analytics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  const { data: analytics, isLoading } = useDashboardAnalytics()

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-28 mb-2" />
              <Skeleton className="h-8 w-36 mb-2" />
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
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Business Analytics & Profitability</h1>
        <p className="text-sm text-muted-foreground">
          Real-time performance metrics, product profitability, and customer spend concentration.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Net Operating Margin</CardDescription>
            <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-500">
              <TrendingUpIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatMoney(netProfit)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Badge variant={profitMargin >= 0 ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                {profitMargin}% margin
              </Badge>
              <span>Sales vs Purchases</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Average Order Value</CardDescription>
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <DollarSignIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatMoney(aov)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average revenue per confirmed invoice
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Collection Efficiency</CardDescription>
            <div className="rounded-md bg-indigo-500/10 p-1.5 text-indigo-500">
              <PercentIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {collectionRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Realized cash against total invoiced amount
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Procurement Spend</CardDescription>
            <div className="rounded-md bg-amber-500/10 p-1.5 text-amber-500">
              <ShoppingBagIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatMoney(purchases)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total vendor purchase bills recorded
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
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <PackageIcon className="size-4 text-primary" />
                  Top Selling Products
                </CardTitle>
                <CardDescription>Ranked by gross sales volume and revenue</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No product sales data available yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">#</th>
                      <th className="pb-2 text-left font-medium">Product</th>
                      <th className="pb-2 text-right font-medium">Qty Sold</th>
                      <th className="pb-2 text-right font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-muted/40">
                        <td className="py-2.5 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                        <td className="py-2.5">
                          <p className="font-medium text-foreground">{p.name}</p>
                          {p.sku ? <p className="text-xs text-muted-foreground">SKU: {p.sku}</p> : null}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground">{p.quantity}</td>
                        <td className="py-2.5 text-right font-semibold tabular-nums">{formatMoney(p.revenue)}</td>
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
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <UsersIcon className="size-4 text-primary" />
                  High-Value Customers
                </CardTitle>
                <CardDescription>Top revenue-generating customer accounts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No customer transactions recorded yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">#</th>
                      <th className="pb-2 text-left font-medium">Customer</th>
                      <th className="pb-2 text-right font-medium">Invoices</th>
                      <th className="pb-2 text-right font-medium">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topCustomers.map((c, idx) => (
                      <tr key={idx} className="hover:bg-muted/40">
                        <td className="py-2.5 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                        <td className="py-2.5 font-medium text-foreground">{c.name}</td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground">{c.invoiceCount}</td>
                        <td className="py-2.5 text-right font-semibold tabular-nums text-primary">
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
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCardIcon className="size-4 text-primary" />
            Payment Collections Breakdown
          </CardTitle>
          <CardDescription>Distribution of realized revenue across payment channels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {paymentMethods.map((pm) => (
              <div key={pm.method} className="rounded-lg border bg-card/60 p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold capitalize text-muted-foreground">
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
