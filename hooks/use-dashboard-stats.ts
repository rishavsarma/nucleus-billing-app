"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/axios"

export interface DashboardStats {
  totalRevenue: number
  totalCollected: number
  totalOutstanding: number
  totalExpenses: number
  invoicesCount: number
  customersCount: number
  recentInvoices: Array<{
    id: string
    invoice_number: string | null
    status: string
    total: number
    amount_paid: number
    issue_date: string
    created_at: string
    customer: { id: string; name: string } | null
  }>
  chartData: Array<{
    date: string
    revenue: number
    collected: number
  }>
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>("/dashboard/stats")
  return data
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: fetchDashboardStats,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
