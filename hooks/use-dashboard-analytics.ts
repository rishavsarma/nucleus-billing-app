"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/axios"

export interface AnalyticsData {
  totalSales: number
  totalPurchases: number
  netProfit: number
  profitMargin: number
  aov: number
  collectionRate: number
  totalInvoicesCount: number
  topProducts: Array<{
    name: string
    sku: string | null
    quantity: number
    revenue: number
  }>
  topCustomers: Array<{
    name: string
    totalInvoiced: number
    invoiceCount: number
  }>
  paymentMethods: Array<{
    method: string
    amount: number
    percentage: number
  }>
}

export async function fetchAnalyticsData(): Promise<AnalyticsData> {
  const { data } = await api.get<AnalyticsData>("/dashboard/analytics")
  return data
}

export function useDashboardAnalytics() {
  return useQuery({
    queryKey: ["dashboard", "analytics"],
    queryFn: fetchAnalyticsData,
    staleTime: 20_000,
    refetchInterval: 60_000,
  })
}
