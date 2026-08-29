"use client"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DollarSignIcon, ArrowDownLeftIcon, AlertCircleIcon, ShoppingBagIcon } from "lucide-react"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { Skeleton } from "@/components/ui/skeleton"

const formatMoney = (n: number) =>
  "₹" +
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function SectionCards() {
  const { data: stats, isLoading } = useDashboardStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="@container/card p-4">
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-8 w-36 mb-2" />
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
            <CardDescription>Total Invoiced Sales</CardDescription>
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
            <span>{stats?.invoicesCount ?? 0} confirmed invoices</span>
          </div>
          <div className="text-muted-foreground text-xs">
            Total sales generated across all customers
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>Total Collected Cash</CardDescription>
            <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-500">
              <ArrowDownLeftIcon className="size-4" />
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-emerald-600 dark:text-emerald-400">
            {formatMoney(collected)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <span>Realized Collections</span>
          </div>
          <div className="text-muted-foreground text-xs">
            Cash, UPI & bank payments recorded
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>Outstanding Receivables</CardDescription>
            <div className="rounded-md bg-amber-500/10 p-1.5 text-amber-500">
              <AlertCircleIcon className="size-4" />
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-amber-600 dark:text-amber-400">
            {formatMoney(outstanding)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
            <span>Pending customer balances</span>
          </div>
          <div className="text-muted-foreground text-xs">
            Unpaid / partially paid invoice balances
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>Purchase Bills & Expenses</CardDescription>
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
            <span>Vendor procurement</span>
          </div>
          <div className="text-muted-foreground text-xs">
            Total expenses & inventory purchase bills
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
