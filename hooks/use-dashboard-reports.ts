"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/axios"

export interface ReportsData {
  salesSummary: {
    invoiceCount: number
    taxableValue: number
    cgst: number
    sgst: number
    totalTax: number
    grossTotal: number
  }
  purchaseSummary: {
    billCount: number
    taxableValue: number
    totalTax: number
    grossTotal: number
    itcAvailable: number
  }
  aging: {
    notDue: number
    days1To30: number
    days31To60: number
    days61To90: number
    days90Plus: number
    totalUnpaid: number
  }
}

export async function fetchReportsData(): Promise<ReportsData> {
  const { data } = await api.get<ReportsData>("/dashboard/reports")
  return data
}

export function useDashboardReports() {
  return useQuery({
    queryKey: ["dashboard", "reports"],
    queryFn: fetchReportsData,
    staleTime: 20_000,
    refetchInterval: 60_000,
  })
}
