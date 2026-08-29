"use client"

import { useDashboardReports } from "@/hooks/use-dashboard-reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PrinterIcon, ReceiptIcon, ShieldCheckIcon, ClockIcon, CalculatorIcon } from "lucide-react"

const formatMoney = (n: number) =>
  "₹" +
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default function ReportsPage() {
  const { data: reports, isLoading } = useDashboardReports()

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 py-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <Skeleton className="h-52 w-full rounded-xl" />
      </div>
    )
  }

  const sales = reports?.salesSummary
  const purchases = reports?.purchaseSummary
  const aging = reports?.aging

  const outputTax = sales?.totalTax ?? 0
  const inputTax = purchases?.itcAvailable ?? 0
  const netTaxPayable = Math.max(0, outputTax - inputTax)

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Tax & Financial Statements</h1>
          <p className="text-sm text-muted-foreground">
            GST compliance breakdown, accounts receivable aging, and input tax credits.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 print:hidden">
          <PrinterIcon className="size-4" />
          Print Statement
        </Button>
      </div>

      {/* Tax Liability Quick Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalculatorIcon className="size-5 text-primary" />
              <CardTitle className="text-base font-semibold">Net GST Tax Position</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {netTaxPayable > 0 ? "Tax Payable" : "ITC Surplus"}
            </Badge>
          </div>
          <CardDescription>
            Calculated as Output Tax Liability minus Eligible Input Tax Credit (ITC)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Output Tax (Sales)</p>
              <p className="text-lg font-bold tabular-nums text-foreground">{formatMoney(outputTax)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Input Tax Credit (Purchases)</p>
              <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                - {formatMoney(inputTax)}
              </p>
            </div>
            <div className="rounded-lg border bg-primary/10 border-primary/20 p-3">
              <p className="text-xs font-semibold text-primary">Net Tax Liability</p>
              <p className="text-xl font-extrabold tabular-nums text-primary">{formatMoney(netTaxPayable)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2-Column Tax Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sales & Output Tax Statement */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ReceiptIcon className="size-5 text-primary" />
              <div>
                <CardTitle className="text-base font-semibold">Sales & Output GST Summary</CardTitle>
                <CardDescription>GSTR-1 matching output liability on confirmed sales</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-1.5 border-b text-sm">
              <span className="text-muted-foreground">Confirmed Invoices</span>
              <span className="font-semibold tabular-nums">{sales?.invoiceCount ?? 0}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b text-sm">
              <span className="text-muted-foreground">Total Taxable Value</span>
              <span className="font-semibold tabular-nums">{formatMoney(sales?.taxableValue ?? 0)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b text-sm">
              <span className="text-muted-foreground">Central GST (CGST)</span>
              <span className="tabular-nums text-muted-foreground">{formatMoney(sales?.cgst ?? 0)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b text-sm">
              <span className="text-muted-foreground">State GST (SGST)</span>
              <span className="tabular-nums text-muted-foreground">{formatMoney(sales?.sgst ?? 0)}</span>
            </div>
            <div className="flex justify-between py-2 border-t font-medium text-base text-primary">
              <span>Gross Sales (Inc. Tax)</span>
              <span className="font-bold tabular-nums">{formatMoney(sales?.grossTotal ?? 0)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Purchases & ITC Statement */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="size-5 text-emerald-500" />
              <div>
                <CardTitle className="text-base font-semibold">Purchases & Input Tax Credit (ITC)</CardTitle>
                <CardDescription>Eligible input tax credit from vendor purchase bills</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-1.5 border-b text-sm">
              <span className="text-muted-foreground">Vendor Purchase Bills</span>
              <span className="font-semibold tabular-nums">{purchases?.billCount ?? 0}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b text-sm">
              <span className="text-muted-foreground">Taxable Purchase Value</span>
              <span className="font-semibold tabular-nums">{formatMoney(purchases?.taxableValue ?? 0)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b text-sm">
              <span className="text-muted-foreground">Total Input Tax (ITC)</span>
              <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(purchases?.totalTax ?? 0)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-t font-medium text-base">
              <span>Gross Purchases</span>
              <span className="font-bold tabular-nums">{formatMoney(purchases?.grossTotal ?? 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Receivable Aging */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClockIcon className="size-5 text-amber-500" />
            <div>
              <CardTitle className="text-base font-semibold">Accounts Receivable Aging Report</CardTitle>
              <CardDescription>Overdue customer balances grouped by aging buckets</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Not Due Yet</p>
              <p className="text-base font-bold tabular-nums text-foreground">{formatMoney(aging?.notDue ?? 0)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">1–30 Days</p>
              <p className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {formatMoney(aging?.days1To30 ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">31–60 Days</p>
              <p className="text-base font-bold tabular-nums text-orange-600 dark:text-orange-400">
                {formatMoney(aging?.days31To60 ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">61–90 Days</p>
              <p className="text-base font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {formatMoney(aging?.days61To90 ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">90+ Days</p>
              <p className="text-base font-bold tabular-nums text-red-600 dark:text-red-500">
                {formatMoney(aging?.days90Plus ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-primary/10 border-primary/20 p-3 text-center">
              <p className="text-xs font-semibold text-primary mb-1">Total Outstanding</p>
              <p className="text-base font-extrabold tabular-nums text-primary">
                {formatMoney(aging?.totalUnpaid ?? 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
