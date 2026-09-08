"use client"

import { useTranslations } from "next-intl"

import { useDashboardReports } from "@/hooks/use-dashboard-reports"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  PrinterIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  ClockIcon,
  CalculatorIcon,
} from "lucide-react"

const formatMoney = (n: number) =>
  "₹" +
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default function ReportsPage() {
  const t = useTranslations("DashboardReports")
  const { data: reports, isLoading } = useDashboardReports()

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 py-4">
        <div className="flex items-center justify-between">
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
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="gap-1.5 print:hidden"
        >
          <PrinterIcon className="size-4" />
          {t("printStatement")}
        </Button>
      </div>

      {/* Tax Liability Quick Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalculatorIcon className="size-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                {t("netTaxPositionTitle")}
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {netTaxPayable > 0 ? t("taxPayable") : t("itcSurplus")}
            </Badge>
          </div>
          <CardDescription>{t("netTaxPositionDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{t("outputTax")}</p>
              <p className="text-lg font-bold text-foreground tabular-nums">
                {formatMoney(outputTax)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">
                {t("inputTaxCredit")}
              </p>
              <p className="text-lg font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                - {formatMoney(inputTax)}
              </p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
              <p className="text-xs font-semibold text-primary">
                {t("netTaxLiability")}
              </p>
              <p className="text-xl font-extrabold text-primary tabular-nums">
                {formatMoney(netTaxPayable)}
              </p>
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
                <CardTitle className="text-base font-semibold">
                  {t("salesSummaryTitle")}
                </CardTitle>
                <CardDescription>
                  {t("salesSummaryDescription")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between border-b py-1.5 text-sm">
              <span className="text-muted-foreground">
                {t("confirmedInvoices")}
              </span>
              <span className="font-semibold tabular-nums">
                {sales?.invoiceCount ?? 0}
              </span>
            </div>
            <div className="flex justify-between border-b py-1.5 text-sm">
              <span className="text-muted-foreground">
                {t("totalTaxableValue")}
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(sales?.taxableValue ?? 0)}
              </span>
            </div>
            <div className="flex justify-between border-b py-1.5 text-sm">
              <span className="text-muted-foreground">{t("cgst")}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatMoney(sales?.cgst ?? 0)}
              </span>
            </div>
            <div className="flex justify-between border-b py-1.5 text-sm">
              <span className="text-muted-foreground">{t("sgst")}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatMoney(sales?.sgst ?? 0)}
              </span>
            </div>
            <div className="flex justify-between border-t py-2 text-base font-medium text-primary">
              <span>{t("grossSales")}</span>
              <span className="font-bold tabular-nums">
                {formatMoney(sales?.grossTotal ?? 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Purchases & ITC Statement */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="size-5 text-emerald-500" />
              <div>
                <CardTitle className="text-base font-semibold">
                  {t("purchaseSummaryTitle")}
                </CardTitle>
                <CardDescription>
                  {t("purchaseSummaryDescription")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between border-b py-1.5 text-sm">
              <span className="text-muted-foreground">
                {t("vendorPurchaseBills")}
              </span>
              <span className="font-semibold tabular-nums">
                {purchases?.billCount ?? 0}
              </span>
            </div>
            <div className="flex justify-between border-b py-1.5 text-sm">
              <span className="text-muted-foreground">
                {t("taxablePurchaseValue")}
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(purchases?.taxableValue ?? 0)}
              </span>
            </div>
            <div className="flex justify-between border-b py-1.5 text-sm">
              <span className="text-muted-foreground">
                {t("totalInputTax")}
              </span>
              <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                {formatMoney(purchases?.totalTax ?? 0)}
              </span>
            </div>
            <div className="flex justify-between border-t py-2 text-base font-medium">
              <span>{t("grossPurchases")}</span>
              <span className="font-bold tabular-nums">
                {formatMoney(purchases?.grossTotal ?? 0)}
              </span>
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
              <CardTitle className="text-base font-semibold">
                {t("agingTitle")}
              </CardTitle>
              <CardDescription>{t("agingDescription")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="mb-1 text-xs text-muted-foreground">
                {t("notDueYet")}
              </p>
              <p className="text-base font-bold text-foreground tabular-nums">
                {formatMoney(aging?.notDue ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="mb-1 text-xs text-muted-foreground">
                {t("days1To30")}
              </p>
              <p className="text-base font-bold text-amber-600 tabular-nums dark:text-amber-400">
                {formatMoney(aging?.days1To30 ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="mb-1 text-xs text-muted-foreground">
                {t("days31To60")}
              </p>
              <p className="text-base font-bold text-orange-600 tabular-nums dark:text-orange-400">
                {formatMoney(aging?.days31To60 ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="mb-1 text-xs text-muted-foreground">
                {t("days61To90")}
              </p>
              <p className="text-base font-bold text-rose-600 tabular-nums dark:text-rose-400">
                {formatMoney(aging?.days61To90 ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="mb-1 text-xs text-muted-foreground">
                {t("days90Plus")}
              </p>
              <p className="text-base font-bold text-red-600 tabular-nums dark:text-red-500">
                {formatMoney(aging?.days90Plus ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-center">
              <p className="mb-1 text-xs font-semibold text-primary">
                {t("totalOutstanding")}
              </p>
              <p className="text-base font-extrabold text-primary tabular-nums">
                {formatMoney(aging?.totalUnpaid ?? 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
