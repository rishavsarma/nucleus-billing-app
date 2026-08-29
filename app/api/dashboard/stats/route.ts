import { NextResponse } from "next/server"
import { requireOrgId } from "@/lib/database/require-org"
import { cacheGet, cacheSet } from "@/lib/cache"

const DASHBOARD_CACHE_TTL_SECONDS = 30

function dashboardCacheKey(orgId: string) {
  return `dashboard:stats:${orgId}`
}

export async function GET() {
  const auth = await requireOrgId()
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauthorized" ? 401 : 403 },
    )
  }

  const orgId = auth.orgId!
  const supabase = auth.supabase

  // Fast path: cached dashboard stats in Redis
  const cached = await cacheGet(dashboardCacheKey(orgId))
  if (cached) {
    return NextResponse.json(JSON.parse(cached))
  }

  try {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().slice(0, 10)

    // Execute queries in parallel for high throughput
    const [
      invoicesResult,
      purchaseBillsResult,
      customersResult,
      recentInvoicesResult,
      chartInvoicesResult,
      chartPaymentsResult,
    ] = await Promise.all([
      supabase
        .schema("billing")
        .from("invoices")
        .select("total, amount_paid, status")
        .eq("org_id", orgId)
        .neq("status", "void"),

      supabase
        .schema("billing")
        .from("purchase_bills")
        .select("total, amount_paid, status")
        .eq("org_id", orgId)
        .neq("status", "void"),

      supabase
        .schema("billing")
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId),

      supabase
        .schema("billing")
        .from("invoices")
        .select(`
          id,
          invoice_number,
          status,
          total,
          amount_paid,
          issue_date,
          created_at,
          customer:customers(id, name)
        `)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(6),

      supabase
        .schema("billing")
        .from("invoices")
        .select("issue_date, total")
        .eq("org_id", orgId)
        .neq("status", "void")
        .gte("issue_date", ninetyDaysAgoStr),

      supabase
        .schema("billing")
        .from("payments")
        .select("paid_at, amount")
        .eq("org_id", orgId)
        .gte("paid_at", ninetyDaysAgo.toISOString()),
    ])

    const invoices = invoicesResult.data ?? []
    const purchaseBills = purchaseBillsResult.data ?? []
    const customersCount = customersResult.count ?? 0

    let totalRevenue = 0
    let totalCollected = 0
    let totalExpenses = 0

    for (const inv of invoices) {
      totalRevenue += Number(inv.total || 0)
      totalCollected += Number(inv.amount_paid || 0)
    }

    for (const bill of purchaseBills) {
      totalExpenses += Number(bill.total || 0)
    }

    const totalOutstanding = Math.max(0, totalRevenue - totalCollected)

    // Build day-by-day aggregate timeline for charts
    const dateMap: Record<string, { revenue: number; collected: number }> = {}
    
    // Initialize past 90 days
    for (let i = 89; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      dateMap[key] = { revenue: 0, collected: 0 }
    }

    for (const inv of chartInvoicesResult.data ?? []) {
      const dateKey = inv.issue_date
      if (dateMap[dateKey]) {
        dateMap[dateKey].revenue += Number(inv.total || 0)
      }
    }

    for (const pmt of chartPaymentsResult.data ?? []) {
      const dateKey = pmt.paid_at.slice(0, 10)
      if (dateMap[dateKey]) {
        dateMap[dateKey].collected += Number(pmt.amount || 0)
      }
    }

    const chartData = Object.entries(dateMap).map(([date, values]) => ({
      date,
      revenue: Math.round(values.revenue * 100) / 100,
      collected: Math.round(values.collected * 100) / 100,
    }))

    const payload = {
      totalRevenue,
      totalCollected,
      totalOutstanding,
      totalExpenses,
      invoicesCount: invoices.length,
      customersCount,
      recentInvoices: recentInvoicesResult.data ?? [],
      chartData,
    }

    // Cache in Redis for fast subsequent loads
    await cacheSet(dashboardCacheKey(orgId), JSON.stringify(payload), DASHBOARD_CACHE_TTL_SECONDS)

    return NextResponse.json(payload)
  } catch (err) {
    console.error("Failed to load dashboard stats:", err)
    return NextResponse.json({ error: "Failed to load dashboard stats" }, { status: 500 })
  }
}
