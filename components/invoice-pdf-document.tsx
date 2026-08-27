import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"

import { amountToWords } from "@/lib/number-to-words"
import type { Customer, Invoice, InvoiceItem, Item, Organization } from "@/lib/database/types"

// Noto Sans, not a core PDF font — the core 14 (Helvetica etc.) don't carry
// the ₹ (U+20B9) glyph at all, which would silently render as a blank box.
// Registered once per module load; safe to call more than once (react-pdf
// no-ops a duplicate family registration).
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: "/fonts/NotoSans-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/NotoSans-Bold.ttf", fontWeight: 700 },
  ],
})

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// GST halves are commonly x.5 (5% -> 2.5% + 2.5%) — round to whole % only
// when the value actually is whole, instead of always flooring/rounding to
// 0 decimals and silently turning 2.5% into "3%".
const formatRate = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

const INK = "#000000"
const MUTED = "#555555"
const PANEL = "#f2f2f2"

// react-pdf draws every border independently — there's no CSS border-collapse
// equivalent. The outer box carries only its top+left border; every
// row/cell carries only its own right+bottom border. Adjacent edges then
// line up as a single 1pt rule instead of doubling up to ~2pt.
const styles = StyleSheet.create({
  page: { padding: 20, fontFamily: "Noto Sans", fontSize: 8, color: INK },
  outer: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: INK },

  // Positioned first (painted first, so every later element draws over it)
  // and absolute (so it never participates in layout flow) — a low-opacity,
  // rotated block of text sitting behind the real content. `fixed` repeats
  // it on every page if the invoice ever spans more than one.
  watermark: {
    position: "absolute",
    top: "42%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 56,
    fontWeight: 700,
    color: "#000000",
    opacity: 0.07,
    transform: "rotate(-30deg)",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  taxInvoiceLabel: { fontSize: 10, fontWeight: 700 },
  originalBadge: { borderWidth: 1, borderColor: INK, paddingVertical: 2, paddingHorizontal: 6, fontSize: 6.5, fontWeight: 700 },

  sellerRow: { flexDirection: "row", borderRightWidth: 1, borderBottomWidth: 1, borderColor: INK },
  sellerCol: { flex: 1, flexDirection: "row", gap: 8, borderRightWidth: 1, borderColor: INK, padding: 10 },
  logo: { width: 30, height: 30, objectFit: "contain" },
  orgName: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  smallText: { fontSize: 7.5, marginBottom: 2, color: MUTED },
  inlineRow: { flexDirection: "row", gap: 12, marginTop: 2 },
  inlineText: { fontSize: 7.5 },
  inlineLabel: { fontWeight: 700 },

  metaCol: { width: 140, padding: 10 },
  metaLabel: { fontSize: 6.5, color: MUTED },
  metaValue: { fontSize: 8.5, fontWeight: 700, marginBottom: 8 },

  billShipRow: { flexDirection: "row", borderRightWidth: 1, borderBottomWidth: 1, borderColor: INK },
  billCol: { flex: 1, borderRightWidth: 1, borderColor: INK, padding: 10 },
  shipCol: { flex: 1, padding: 10 },
  sectionLabel: { fontSize: 8, fontWeight: 700, marginBottom: 3 },
  partyName: { fontSize: 8.5, fontWeight: 700, marginBottom: 2 },
  partyLine: { fontSize: 7.5, marginBottom: 1 },

  itemsHeadRow: { flexDirection: "row", backgroundColor: PANEL },
  itemsRow: { flexDirection: "row" },
  th: {
    fontSize: 7,
    fontWeight: 700,
    padding: 5,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  td: {
    fontSize: 7.5,
    padding: 5,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  colSno: { width: "6%" },
  colItems: { width: "54%" },
  colQty: { width: "12%", textAlign: "right" },
  colRate: { width: "14%", textAlign: "right" },
  colAmount: { width: "14%", textAlign: "right" },
  subline: { fontSize: 6.5, color: MUTED, marginTop: 1 },

  taxSummaryRow: { flexDirection: "row" },
  taxLabelCell: {
    width: "86%",
    fontSize: 7.5,
    fontWeight: 700,
    padding: 5,
    textAlign: "right",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  taxAmountCell: {
    width: "14%",
    fontSize: 7.5,
    fontWeight: 700,
    padding: 5,
    textAlign: "right",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  totalRow: { flexDirection: "row", backgroundColor: PANEL },
  totalLabelCell: {
    width: "60%",
    fontSize: 8,
    fontWeight: 700,
    padding: 5,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  totalQtyCell: {
    width: "26%",
    fontSize: 8,
    fontWeight: 700,
    padding: 5,
    textAlign: "right",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  totalAmountCell: {
    width: "14%",
    fontSize: 8,
    fontWeight: 700,
    padding: 5,
    textAlign: "right",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },

  hsnHeadRow: { flexDirection: "row", backgroundColor: PANEL },
  hsnRow: { flexDirection: "row" },
  hsnTh: { fontSize: 6.5, fontWeight: 700, padding: 4, textAlign: "center", borderRightWidth: 1, borderBottomWidth: 1, borderColor: INK },
  hsnTd: { fontSize: 7, padding: 4, textAlign: "right", borderRightWidth: 1, borderBottomWidth: 1, borderColor: INK },
  colHsn: { width: "12%", textAlign: "left" },
  colTaxable: { width: "16%" },
  colRate2: { width: "9%" },
  colTaxAmt: { width: "13%" },
  colTotalTax: { width: "28%" },

  wordsBlock: { borderRightWidth: 1, borderBottomWidth: 1, borderColor: INK, padding: 10 },
  wordsLabel: { fontSize: 8, fontWeight: 700, marginBottom: 2 },
  wordsValue: { fontSize: 8 },

  signBlock: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
    padding: 10,
    paddingTop: 40,
  },
  signText: { fontSize: 7.5, textAlign: "center" },
  signOrg: { fontSize: 8, fontWeight: 700, textAlign: "center", marginTop: 2 },
})

type BillingAddress = {
  line1?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

function formatAddress(address: BillingAddress | null | undefined): string[] {
  if (!address) return []
  const line2 = [address.city, address.state, address.postal_code].filter(Boolean).join(", ")
  return [address.line1, line2, address.country].filter((line): line is string => !!line)
}

function splitDescription(description: string): { name: string; sublines: string[] } {
  const [name, ...sublines] = description.split("\n").map((line) => line.trim())
  return { name: name || description, sublines: sublines.filter(Boolean) }
}

export type InvoicePdfLabels = {
  taxInvoice: string
  originalForRecipient: string
  gstinLabel: string
  panLabel: string
  mobileLabel: string
  invoiceNoLabel: string
  invoiceDateLabel: string
  billToLabel: string
  shipToLabel: string
  addressLabel: string
  placeOfSupplyLabel: string
  snoLabel: string
  itemsLabel: string
  qtyLabel: string
  rateLabel: string
  amountLabel: string
  unitAbbrev: string
  cgstLabel: string
  sgstLabel: string
  totalLabel: string
  hsnSacLabel: string
  taxableValueLabel: string
  cgstColumnLabel: string
  sgstColumnLabel: string
  rateColumnLabel: string
  amountColumnLabel: string
  totalTaxAmountLabel: string
  amountInWordsLabel: string
  authorisedSignatoryLabel: string
}

export function InvoicePdfDocument({
  invoice,
  customer,
  organization,
  lineItems,
  items,
  labels,
  watermarkText,
}: {
  invoice: Invoice
  customer: Customer | undefined
  organization: Organization | undefined
  lineItems: InvoiceItem[]
  items: Item[] | undefined
  labels: InvoicePdfLabels
  watermarkText?: string | null
}) {
  const billingAddress = (customer?.billing_address ?? null) as BillingAddress | null
  const addressLines = formatAddress(billingAddress)
  const placeOfSupply = billingAddress?.state || organization?.state_code || "—"

  const cgst = invoice.tax_total / 2
  const sgst = invoice.tax_total / 2
  const totalQty = lineItems.reduce((sum, line) => sum + line.quantity, 0)

  const hsnGroups = new Map<string, { hsnSac: string; rate: number; taxable: number; tax: number }>()
  for (const line of lineItems) {
    const item = items?.find((i) => i.id === line.item_id)
    const hsnSac = item?.hsn_sac_code || "-"
    const key = `${hsnSac}__${line.tax_rate}`
    const existing = hsnGroups.get(key)
    if (existing) {
      existing.taxable += line.line_subtotal
      existing.tax += line.line_tax
    } else {
      hsnGroups.set(key, { hsnSac, rate: line.tax_rate, taxable: line.line_subtotal, tax: line.line_tax })
    }
  }
  const hsnRows = Array.from(hsnGroups.values())

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {watermarkText ? (
          <Text style={styles.watermark} fixed>
            {watermarkText}
          </Text>
        ) : null}
        <View style={styles.outer}>
          <View style={styles.headerRow}>
            <Text style={styles.taxInvoiceLabel}>{labels.taxInvoice}</Text>
            <Text style={styles.originalBadge}>{labels.originalForRecipient}</Text>
          </View>

          <View style={styles.sellerRow}>
            <View style={styles.sellerCol}>
              {organization?.pdf_logo_url ? <Image src={organization.pdf_logo_url} style={styles.logo} /> : null}
              <View>
                <Text style={styles.orgName}>{organization?.name ?? "—"}</Text>
                {organization?.address ? <Text style={styles.smallText}>{organization.address}</Text> : null}
                <View style={styles.inlineRow}>
                  {organization?.gstin ? (
                    <Text style={styles.inlineText}>
                      {labels.gstinLabel}: {organization.gstin}
                    </Text>
                  ) : null}
                  {organization?.phone ? (
                    <Text style={styles.inlineText}>
                      <Text style={styles.inlineLabel}>{labels.mobileLabel}: </Text>
                      {organization.phone}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.inlineRow}>
                  {organization?.pan ? (
                    <Text style={styles.inlineText}>
                      {labels.panLabel}: {organization.pan}
                    </Text>
                  ) : null}
                  {organization?.billing_email ? <Text style={styles.inlineText}>{organization.billing_email}</Text> : null}
                </View>
              </View>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>{labels.invoiceNoLabel}</Text>
              <Text style={styles.metaValue}>{invoice.invoice_number ?? "—"}</Text>
              <Text style={styles.metaLabel}>{labels.invoiceDateLabel}</Text>
              <Text style={styles.metaValue}>{invoice.issue_date}</Text>
            </View>
          </View>

          <View style={styles.billShipRow}>
            <View style={styles.billCol}>
              <Text style={styles.sectionLabel}>{labels.billToLabel}</Text>
              <Text style={styles.partyName}>{customer?.name ?? "—"}</Text>
              {addressLines.length ? (
                <Text style={styles.partyLine}>
                  {labels.addressLabel}: {addressLines.join(", ")}
                </Text>
              ) : null}
              <Text style={styles.partyLine}>
                {labels.placeOfSupplyLabel}: {placeOfSupply}
              </Text>
              {customer?.phone ? (
                <Text style={styles.partyLine}>
                  {labels.mobileLabel}: {customer.phone}
                </Text>
              ) : null}
            </View>
            <View style={styles.shipCol}>
              <Text style={styles.sectionLabel}>{labels.shipToLabel}</Text>
              <Text style={styles.partyName}>{customer?.name ?? "—"}</Text>
              {addressLines.length ? (
                <Text style={styles.partyLine}>
                  {labels.addressLabel}: {addressLines.join(", ")}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.itemsHeadRow}>
            <Text style={[styles.th, styles.colSno]}>{labels.snoLabel}</Text>
            <Text style={[styles.th, styles.colItems]}>{labels.itemsLabel}</Text>
            <Text style={[styles.th, styles.colQty]}>{labels.qtyLabel}</Text>
            <Text style={[styles.th, styles.colRate]}>{labels.rateLabel}</Text>
            <Text style={[styles.th, styles.colAmount]}>{labels.amountLabel}</Text>
          </View>
          {lineItems.map((line, index) => {
            const { name, sublines } = splitDescription(line.description)
            return (
              <View key={line.id} style={styles.itemsRow}>
                <Text style={[styles.td, styles.colSno]}>{index + 1}</Text>
                <View style={[styles.td, styles.colItems]}>
                  <Text>{name}</Text>
                  {sublines.map((sub, i) => (
                    <Text key={i} style={styles.subline}>
                      {sub}
                    </Text>
                  ))}
                </View>
                <Text style={[styles.td, styles.colQty]}>
                  {line.quantity} {labels.unitAbbrev}
                </Text>
                <Text style={[styles.td, styles.colRate]}>{num(line.unit_price)}</Text>
                <Text style={[styles.td, styles.colAmount]}>{num(line.line_subtotal)}</Text>
              </View>
            )
          })}
          <View style={styles.taxSummaryRow}>
            <Text style={styles.taxLabelCell}>{labels.cgstLabel}</Text>
            <Text style={styles.taxAmountCell}>{money(cgst)}</Text>
          </View>
          <View style={styles.taxSummaryRow}>
            <Text style={styles.taxLabelCell}>{labels.sgstLabel}</Text>
            <Text style={styles.taxAmountCell}>{money(sgst)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabelCell}>{labels.totalLabel}</Text>
            <Text style={styles.totalQtyCell}>{totalQty}</Text>
            <Text style={styles.totalAmountCell}>{money(invoice.total)}</Text>
          </View>

          <View style={styles.hsnHeadRow}>
            <Text style={[styles.hsnTh, styles.colHsn]}>{labels.hsnSacLabel}</Text>
            <Text style={[styles.hsnTh, styles.colTaxable]}>{labels.taxableValueLabel}</Text>
            <Text style={[styles.hsnTh, styles.colRate2]}>{labels.cgstColumnLabel} {labels.rateColumnLabel}</Text>
            <Text style={[styles.hsnTh, styles.colTaxAmt]}>{labels.cgstColumnLabel} {labels.amountColumnLabel}</Text>
            <Text style={[styles.hsnTh, styles.colRate2]}>{labels.sgstColumnLabel} {labels.rateColumnLabel}</Text>
            <Text style={[styles.hsnTh, styles.colTaxAmt]}>{labels.sgstColumnLabel} {labels.amountColumnLabel}</Text>
            <Text style={[styles.hsnTh, styles.colTotalTax]}>{labels.totalTaxAmountLabel}</Text>
          </View>
          {hsnRows.map((row) => (
            <View key={row.hsnSac + row.rate} style={styles.hsnRow}>
              <Text style={[styles.hsnTd, styles.colHsn]}>{row.hsnSac}</Text>
              <Text style={[styles.hsnTd, styles.colTaxable]}>{num(row.taxable)}</Text>
              <Text style={[styles.hsnTd, styles.colRate2]}>{formatRate(row.rate / 2)}%</Text>
              <Text style={[styles.hsnTd, styles.colTaxAmt]}>{num(row.tax / 2)}</Text>
              <Text style={[styles.hsnTd, styles.colRate2]}>{formatRate(row.rate / 2)}%</Text>
              <Text style={[styles.hsnTd, styles.colTaxAmt]}>{num(row.tax / 2)}</Text>
              <Text style={[styles.hsnTd, styles.colTotalTax]}>{num(row.tax)}</Text>
            </View>
          ))}
          <View style={[styles.hsnRow, { backgroundColor: PANEL }]}>
            <Text style={[styles.hsnTd, styles.colHsn, { fontWeight: 700 }]}>{labels.totalLabel}</Text>
            <Text style={[styles.hsnTd, styles.colTaxable, { fontWeight: 700 }]}>{num(invoice.subtotal)}</Text>
            <Text style={[styles.hsnTd, styles.colRate2]} />
            <Text style={[styles.hsnTd, styles.colTaxAmt, { fontWeight: 700 }]}>{num(cgst)}</Text>
            <Text style={[styles.hsnTd, styles.colRate2]} />
            <Text style={[styles.hsnTd, styles.colTaxAmt, { fontWeight: 700 }]}>{num(sgst)}</Text>
            <Text style={[styles.hsnTd, styles.colTotalTax, { fontWeight: 700 }]}>{num(invoice.tax_total)}</Text>
          </View>

          <View style={styles.wordsBlock}>
            <Text style={styles.wordsLabel}>{labels.amountInWordsLabel}</Text>
            <Text style={styles.wordsValue}>{amountToWords(invoice.total)}</Text>
          </View>

          <View style={styles.signBlock}>
            <View>
              <Text style={styles.signText}>{labels.authorisedSignatoryLabel}</Text>
              <Text style={styles.signOrg}>{organization?.name ?? ""}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
