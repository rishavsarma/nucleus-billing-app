import { NextResponse } from "next/server"
import { requireOrgId } from "@/lib/database/require-org"
import { cacheGet, cacheSet } from "@/lib/cache"

const REPORTS_CACHE_TTL_SECONDS = 30

function reportsCacheKey(orgId: string) {
  return `dashboard:reports:${orgId}`
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

  const cached = await cacheGet(reportsCacheKey(orgId))
  if (cached) {
    return NextResponse.json(JSON.parse(cached))
  }

  try {
    const [invoicesResult, billsResult] = await Promise.all([
      supabase
        .schema("billing")
        .from("invoices")
        .select("id, invoice_number, subtotal, tax_total, total, amount_paid, status, issue_date, due_date")
        .eq("org_id", orgId)
        .neq("status", "void"),

      supabase
        .schema("billing")
        .from("purchase_bills")
        .select("id, bill_number, subtotal, tax_total, total, amount_paid, status, bill_date, due_date")
        .eq("org_id", orgId)
        .neq("status", "void"),
    ])

    const invoices = invoicesResult.data ?? []
    const bills = billsResult.data ?? []

    // 1. Sales & Tax Summary
    let salesTaxable = 0
    let salesTaxTotal = 0
    let salesGross = 0

    for (const inv of invoices) {
      salesTaxable += Number(inv.subtotal || 0)
      salesTaxTotal += Number(inv.tax_total || 0)
      salesGross += Number(inv.total || 0)
    }

    // 2. Purchase & ITC Summary
    let purchaseTaxable = 0
    let purchaseTaxTotal = 0
    let purchaseGross = 0

    for (const bill of bills) {
      purchaseTaxable += Number(bill.subtotal || 0)
      purchaseTaxTotal += Number(bill.tax_total || 0)
      purchaseGross += Number(bill.total || 0)
    }

    // 3. Accounts Receivable Aging
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const aging = {
      notDue: 0,
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      days90Plus: 0,
      totalUnpaid: 0,
    }

    for (const inv of invoices) {
      const balance = Number(inv.total || 0) - Number(inv.amount_paid || 0)
      if (balance <= 0) continue

      aging.totalUnpaid += balance

      if (!inv.due_date) {
        aging.notDue += balance
        continue
      }

      const due = new Date(inv.due_date)
      due.setHours(0, 0, 0, 0)
      const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays <= 0) {
        aging.notDue += balance
      } else if (diffDays <= 30) {
        aging.days1To30 += balance
      } else if (diffDays <= 60) {
        aging.days31To60 += balance
      } else if (diffDays <= 90) {
        aging.days61To90 += balance
      } else {
        aging.days90Plus += balance
      }
    }

    const payload = {
      salesSummary: {
        invoiceCount: invoices.length,
        taxableValue: Math.round(salesTaxable * 100) / 100,
        cgst: Math.round((salesTaxTotal / 2) * 100) / 100,
        sgst: Math.round((salesTaxTotal / 2) * 100) / 100,
        totalTax: Math.round(salesTaxTotal * 100) / 100,
        grossTotal: Math.round(salesGross * 100) / 100,
      },
      purchaseSummary: {
        billCount: bills.length,
        taxableValue: Math.round(purchaseTaxable * 100) / 100,
        totalTax: Math.round(purchaseTaxTotal * 100) / 100,
        grossTotal: Math.round(purchaseGross * 100) / 100,
        itcAvailable: Math.round(purchaseTaxTotal * 100) / 100,
      },
      aging: {
        notDue: Math.round(aging.notDue * 100) / 100,
        days1To30: Math.round(aging.days1To30 * 100) / 100,
        days31To60: Math.round(aging.days31To60 * 100) / 100,
        days61To90: Math.round(aging.days61To90 * 100) / 100,
        days90Plus: Math.round(aging.days90Plus * 100) / 100,
        totalUnpaid: Math.round(aging.totalUnpaid * 100) / 100,
      },
    }

    await cacheSet(reportsCacheKey(orgId), JSON.stringify(payload), REPORTS_CACHE_TTL_SECONDS)

    return NextResponse.json(payload)
  } catch (err) {
    console.error("Failed to load reports:", err)
    return NextResponse.json({ error: "Failed to load reports" }, { status: 500 })
  }
}
