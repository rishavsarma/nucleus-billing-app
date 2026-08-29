"use client"

import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { routes } from "@/lib/routes"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRightIcon, FileTextIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

const formatMoney = (n: number) =>
  "₹" +
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "outline",
  partially_paid: "default",
  paid: "default",
  void: "destructive",
}

type DocStatusKey = "draft" | "sent" | "partially_paid" | "paid" | "void" | "received" | "issued"

export function RecentInvoicesCard() {
  const tStatus = useTranslations("DocStatus")
  const { data: stats, isLoading } = useDashboardStats()

  const recentInvoices = stats?.recentInvoices ?? []

  if (isLoading) {
    return (
      <Card className="px-4 lg:px-6">
        <CardHeader>
          <Skeleton className="h-5 w-36 mb-1" />
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Recent Invoices</CardTitle>
            <CardDescription>Latest sales transactions and payment statuses</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
            <Link href={routes.sales.invoices.list}>
              <span>View all</span>
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <FileTextIcon className="size-8 mb-2 opacity-50" />
              <p className="text-sm">No invoices recorded yet</p>
              <Button size="sm" variant="outline" asChild className="mt-3">
                <Link href={routes.sales.invoices.new}>Create your first invoice</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-3 text-left font-medium">Invoice #</th>
                    <th className="pb-3 text-left font-medium">Customer</th>
                    <th className="pb-3 text-left font-medium">Issue Date</th>
                    <th className="pb-3 text-left font-medium">Status</th>
                    <th className="pb-3 text-right font-medium">Total</th>
                    <th className="pb-3 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentInvoices.map((inv) => {
                    const balance = Math.max(0, Number(inv.total) - Number(inv.amount_paid))
                    return (
                      <tr key={inv.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 font-medium">
                          <Link
                            href={routes.sales.invoices.detail(inv.id)}
                            className="text-primary hover:underline"
                          >
                            {inv.invoice_number ?? "—"}
                          </Link>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {inv.customer?.name ?? "Walk-in Customer"}
                        </td>
                        <td className="py-3 text-muted-foreground">{inv.issue_date}</td>
                        <td className="py-3">
                          <Badge variant={STATUS_VARIANTS[inv.status] ?? "outline"} className="capitalize text-xs">
                            {tStatus(inv.status as DocStatusKey) || inv.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-right font-medium tabular-nums">
                          {formatMoney(Number(inv.total))}
                        </td>
                        <td className="py-3 text-right font-medium tabular-nums text-muted-foreground">
                          {balance > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              {formatMoney(balance)}
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">Paid</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
