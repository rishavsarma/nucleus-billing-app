import { NextResponse } from "next/server"
import { requireOrgId } from "@/lib/database/require-org"
import { cacheGet, cacheSet } from "@/lib/cache"

const ANALYTICS_CACHE_TTL_SECONDS = 30

function analyticsCacheKey(orgId: string) {
  return `dashboard:analytics:${orgId}`
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

  const cached = await cacheGet(analyticsCacheKey(orgId))
  if (cached) {
    return NextResponse.json(JSON.parse(cached))
  }

  try {
    const [
      invoicesResult,
      billsResult,
      invoiceItemsResult,
      paymentsResult,
    ] = await Promise.all([
      supabase
        .schema("billing")
        .from("invoices")
        .select(`
          id,
          total,
          subtotal,
          tax_total,
          amount_paid,
          status,
          issue_date,
          customer:customers(id, name)
        `)
        .eq("org_id", orgId)
        .neq("status", "void"),

      supabase
        .schema("billing")
        .from("purchase_bills")
        .select("total, subtotal, tax_total, amount_paid, status, bill_date")
        .eq("org_id", orgId)
        .neq("status", "void"),

      supabase
        .schema("billing")
        .from("invoice_items")
        .select(`
          id,
          quantity,
          unit_price,
          line_total,
          item:items(id, name, sku)
        `)
        .limit(500),

      supabase
        .schema("billing")
        .from("payments")
        .select("amount, payment_method, paid_at")
        .eq("org_id", orgId),
    ])

    const invoices = invoicesResult.data ?? []
    const bills = billsResult.data ?? []
    const invoiceItems = invoiceItemsResult.data ?? []
    const payments = paymentsResult.data ?? []

    // 1. Core Financial Totals
    let totalSales = 0
    let totalCollected = 0
    for (const inv of invoices) {
      totalSales += Number(inv.total || 0)
      totalCollected += Number(inv.amount_paid || 0)
    }

    let totalPurchases = 0
    for (const bill of bills) {
      totalPurchases += Number(bill.total || 0)
    }

    const netProfit = totalSales - totalPurchases
    const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0
    const aov = invoices.length > 0 ? totalSales / invoices.length : 0
    const collectionRate = totalSales > 0 ? (totalCollected / totalSales) * 100 : 0

    // 2. Top Selling Products
    const itemMap: Record<string, { name: string; sku: string | null; quantity: number; revenue: number }> = {}
    for (const rawLine of invoiceItems) {
      const it = (Array.isArray(rawLine.item) ? rawLine.item[0] : rawLine.item) as
        | { id: string; name: string; sku: string | null }
        | undefined
        | null
      if (!it) continue
      const name = it.name ?? "Unknown Item"
      if (!itemMap[it.id]) {
        itemMap[it.id] = { name, sku: it.sku ?? null, quantity: 0, revenue: 0 }
      }
      itemMap[it.id].quantity += Number(rawLine.quantity || 0)
      itemMap[it.id].revenue += Number(rawLine.line_total || 0)
    }

    const topProducts = Object.values(itemMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // 3. Top Customers
    const customerMap: Record<string, { name: string; totalInvoiced: number; invoiceCount: number }> = {}
    for (const rawInv of invoices) {
      const cust = (Array.isArray(rawInv.customer) ? rawInv.customer[0] : rawInv.customer) as
        | { id: string; name: string }
        | undefined
        | null
      const name = cust?.name ?? "Walk-in Customer"
      const custId = cust?.id ?? "walk-in"
      if (!customerMap[custId]) {
        customerMap[custId] = { name, totalInvoiced: 0, invoiceCount: 0 }
      }
      customerMap[custId].totalInvoiced += Number(rawInv.total || 0)
      customerMap[custId].invoiceCount += 1
    }

    const topCustomers = Object.values(customerMap)
      .sort((a, b) => b.totalInvoiced - a.totalInvoiced)
      .slice(0, 5)

    // 4. Payment Methods Distribution
    const paymentMethodsMap: Record<string, number> = {
      cash: 0,
      upi: 0,
      bank_transfer: 0,
      razorpay: 0,
      manual: 0,
    }

    for (const pmt of payments) {
      const method = pmt.payment_method || "manual"
      if (paymentMethodsMap[method] !== undefined) {
        paymentMethodsMap[method] += Number(pmt.amount || 0)
      } else {
        paymentMethodsMap.manual += Number(pmt.amount || 0)
      }
    }

    const paymentMethods = Object.entries(paymentMethodsMap).map(([method, amount]) => ({
      method,
      amount,
      percentage: totalCollected > 0 ? Math.round((amount / totalCollected) * 100) : 0,
    }))

    const payload = {
      totalSales,
      totalPurchases,
      netProfit,
      profitMargin: Math.round(profitMargin * 10) / 10,
      aov: Math.round(aov * 100) / 100,
      collectionRate: Math.round(collectionRate * 10) / 10,
      totalInvoicesCount: invoices.length,
      topProducts,
      topCustomers,
      paymentMethods,
    }

    await cacheSet(analyticsCacheKey(orgId), JSON.stringify(payload), ANALYTICS_CACHE_TTL_SECONDS)

    return NextResponse.json(payload)
  } catch (err) {
    console.error("Failed to load analytics:", err)
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 })
  }
}
