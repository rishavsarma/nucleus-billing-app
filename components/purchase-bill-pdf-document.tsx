import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  Watermark,
} from "@formepdf/react"

import { amountToWords } from "@/lib/number-to-words"
import { gstStateName } from "@/lib/gst-states"
import type {
  Item,
  Organization,
  OrganizationBankAccount,
  PurchaseBill,
  PurchaseBillItem,
  Vendor,
} from "@/lib/database/types"

// Vendor-side mirror of components/invoice-pdf-document.tsx — same layout and
// styles so the two documents stay visually identical, with the supplier-side
// bits swapped for purchase-bill ones (vendor block instead of bill-to/ship-to,
// unit_cost instead of unit_price, the vendor's own invoice number, and no
// "ORIGINAL FOR RECIPIENT" legend, which only a tax invoice's issuer prints).
//
// Noto Sans, not a core PDF font — the core 14 (Helvetica etc.) don't carry
// the ₹ (U+20B9) glyph at all, which would silently render as a blank box.
// Registered once per module load.
// Forme registers one weight per call (FontRegistration is a single
// {family, src, fontWeight}), unlike react-pdf's fonts[] array form.
Font.register({
  family: "Noto Sans",
  src: "/fonts/NotoSans-Regular.ttf",
  fontWeight: 400,
})
Font.register({
  family: "Noto Sans",
  src: "/fonts/NotoSans-Bold.ttf",
  fontWeight: 700,
})

const money = (n: number) =>
  "₹" +
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
const num = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
// GST halves are commonly x.5 (5% -> 2.5% + 2.5%) — round to whole % only
// when the value actually is whole, instead of always flooring/rounding to
// 0 decimals and silently turning 2.5% into "3%".
const formatRate = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(1)

const INK = "#000000"
const MUTED = "#555555"
const PANEL = "#f2f2f2"

// Forme draws every border independently — there's no CSS border-collapse
// equivalent. The outer box carries only its top+left border; every
// row/cell carries only its own right+bottom border. Adjacent edges then
// line up as a single 1pt rule instead of doubling up to ~2pt.
const styles = StyleSheet.create({
  // No `padding` here — Forme ignores padding in the Page style and takes
  // the page inset from the <Page margin> prop instead (react-pdf used the
  // style). The 20pt inset now lives on the element below.
  page: { fontFamily: "Noto Sans", fontSize: 8, color: INK },
  outer: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: INK },

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

  sellerRow: {
    flexDirection: "row",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  sellerCol: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    borderRightWidth: 1,
    borderColor: INK,
    padding: 10,
  },
  // Forme's Image has no objectFit. Setting width only keeps the source
  // aspect ratio instead of stretching an oblong logo into a square.
  logo: { width: 30 },
  orgName: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  smallText: { fontSize: 7.5, marginBottom: 2, color: MUTED },
  inlineRow: { flexDirection: "row", gap: 12, marginTop: 2 },
  inlineText: { fontSize: 7.5 },
  inlineLabel: { fontWeight: 700 },

  metaCol: { width: 140, padding: 10 },
  metaLabel: { fontSize: 6.5, color: MUTED },
  metaValue: { fontSize: 8.5, fontWeight: 700, marginBottom: 8 },

  billShipRow: {
    flexDirection: "row",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  billCol: { flex: 1, borderRightWidth: 1, borderColor: INK, padding: 10 },
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
  hsnTh: {
    fontSize: 6.5,
    fontWeight: 700,
    padding: 4,
    textAlign: "center",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  hsnTd: {
    fontSize: 7,
    padding: 4,
    textAlign: "right",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  colHsn: { width: "12%", textAlign: "left" },
  colTaxable: { width: "16%" },
  colRate2: { width: "9%" },
  colTaxAmt: { width: "13%" },
  colTotalTax: { width: "28%" },

  wordsBlock: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
    padding: 10,
  },
  wordsLabel: { fontSize: 8, fontWeight: 700, marginBottom: 2 },
  wordsValue: { fontSize: 8 },

  bankSignRow: {
    flexDirection: "row",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  bankBlock: { flex: 1, borderRightWidth: 1, borderColor: INK, padding: 10 },
  bankLabel: { fontSize: 8, fontWeight: 700, marginBottom: 3 },
  bankLine: { fontSize: 7.5, marginBottom: 1 },
  signBlock: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    padding: 10,
    paddingTop: 12,
  },
  signatureImage: {
    // Width only, same reason as `logo` — the signature pad always emits a
    // 480x160 canvas, so this lands at 90x30.
    width: 90,
    marginBottom: 2,
  },
  signText: { fontSize: 7.5, textAlign: "center" },
  signOrg: { fontSize: 8, fontWeight: 700, textAlign: "center", marginTop: 2 },

  roundOffCell: {
    width: "86%",
    fontSize: 7.5,
    fontWeight: 700,
    padding: 5,
    textAlign: "right",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  roundOffAmountCell: {
    width: "14%",
    fontSize: 7.5,
    fontWeight: 700,
    padding: 5,
    textAlign: "right",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
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
  const line2 = [address.city, address.state, address.postal_code]
    .filter(Boolean)
    .join(", ")
  return [address.line1, line2, address.country].filter(
    (line): line is string => !!line
  )
}

function splitDescription(description: string): {
  name: string
  sublines: string[]
} {
  const [name, ...sublines] = description.split("\n").map((line) => line.trim())
  return { name: name || description, sublines: sublines.filter(Boolean) }
}

export type PurchaseBillPdfLabels = {
  purchaseBill: string
  gstinLabel: string
  panLabel: string
  mobileLabel: string
  billNoLabel: string
  vendorInvoiceNoLabel: string
  billDateLabel: string
  vendorLabel: string
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
  igstLabel: string
  igstColumnLabel: string
  roundOffLabel: string
  bankDetailsLabel: string
  accountHolderLabel: string
  accountNumberLabel: string
  ifscLabel: string
  bankNameLabel: string
}

export function PurchaseBillPdfDocument({
  bill,
  vendor,
  organization,
  lineItems,
  items,
  bankAccount,
  labels,
  watermarkText,
}: {
  bill: PurchaseBill
  vendor: Vendor | undefined
  organization: Organization | undefined
  lineItems: PurchaseBillItem[]
  items: Item[] | undefined
  bankAccount?: OrganizationBankAccount | null
  labels: PurchaseBillPdfLabels
  watermarkText?: string | null
}) {
  const billingAddress = (vendor?.billing_address ??
    null) as BillingAddress | null
  const addressLines = formatAddress(billingAddress)
  // Prefer the document's own recorded place of supply (real GST data) over
  // the old best-effort guess from the customer's billing address — that
  // guess stays as a fallback only for invoices created before this field
  // existed.
  const placeOfSupply =
    gstStateName(bill.place_of_supply) ||
    billingAddress?.state ||
    organization?.state_code ||
    "—"
  // Inter-state only when both sides of the comparison are actually known —
  // an invoice with no place_of_supply recorded (created before this field
  // existed) keeps the original CGST+SGST assumption rather than silently
  // becoming an (incorrect) IGST invoice.
  const isInterState =
    !!bill.place_of_supply &&
    !!organization?.state_code &&
    bill.place_of_supply !== organization.state_code

  const cgst = isInterState ? 0 : bill.tax_total / 2
  const sgst = isInterState ? 0 : bill.tax_total / 2
  const igst = isInterState ? bill.tax_total : 0
  const totalQty = lineItems.reduce((sum, line) => sum + line.quantity, 0)

  const hsnGroups = new Map<
    string,
    { hsnSac: string; rate: number; taxable: number; tax: number }
  >()
  for (const line of lineItems) {
    const item = items?.find((i) => i.id === line.item_id)
    const hsnSac = item?.hsn_sac_code || "-"
    const key = `${hsnSac}__${line.tax_rate}`
    const existing = hsnGroups.get(key)
    if (existing) {
      existing.taxable += line.line_subtotal
      existing.tax += line.line_tax
    } else {
      hsnGroups.set(key, {
        hsnSac,
        rate: line.tax_rate,
        taxable: line.line_subtotal,
        tax: line.line_tax,
      })
    }
  }
  const hsnRows = Array.from(hsnGroups.values())

  return (
    <Document>
      <Page size="A4" margin={20} style={styles.page}>
        {watermarkText ? (
          <Watermark
            text={watermarkText}
            fontSize={56}
            // Forme takes the alpha in the colour rather than a separate
            // opacity, and repeats the watermark on every page itself —
            // replacing react-pdf's absolute + rotate + opacity + `fixed`.
            color="rgba(0, 0, 0, 0.07)"
            angle={-30}
          />
        ) : null}
        <View style={styles.outer}>
          <View style={styles.headerRow}>
            <Text style={styles.taxInvoiceLabel}>{labels.purchaseBill}</Text>
          </View>

          <View style={styles.sellerRow}>
            <View style={styles.sellerCol}>
              {organization?.pdf_logo_url ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={organization.pdf_logo_url} style={styles.logo} />
              ) : null}
              <View>
                <Text style={styles.orgName}>{organization?.name ?? "—"}</Text>
                {organization?.address ? (
                  <Text style={styles.smallText}>{organization.address}</Text>
                ) : null}
                <View style={styles.inlineRow}>
                  {organization?.gstin ? (
                    <Text style={styles.inlineText}>
                      {labels.gstinLabel}: {organization.gstin}
                    </Text>
                  ) : null}
                  {organization?.phone ? (
                    <Text style={styles.inlineText}>
                      <Text style={styles.inlineLabel}>
                        {labels.mobileLabel}:{" "}
                      </Text>
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
                  {organization?.billing_email ? (
                    <Text style={styles.inlineText}>
                      {organization.billing_email}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>{labels.billNoLabel}</Text>
              <Text style={styles.metaValue}>
                {bill.bill_number ?? "—"}
              </Text>
              <Text style={styles.metaLabel}>{labels.billDateLabel}</Text>
              <Text style={styles.metaValue}>{bill.bill_date}</Text>
              {bill.vendor_invoice_number ? (
                <>
                  <Text style={styles.metaLabel}>
                    {labels.vendorInvoiceNoLabel}
                  </Text>
                  <Text style={styles.metaValue}>
                    {bill.vendor_invoice_number}
                  </Text>
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.billShipRow}>
            <View style={{ ...styles.billCol, borderRightWidth: 0 }}>
              <Text style={styles.sectionLabel}>{labels.vendorLabel}</Text>
              <Text style={styles.partyName}>{vendor?.name ?? "—"}</Text>
              {vendor?.tax_id ? (
                <Text style={styles.partyLine}>
                  {labels.gstinLabel}: {vendor.tax_id}
                </Text>
              ) : null}
              {addressLines.length ? (
                <Text style={styles.partyLine}>
                  {labels.addressLabel}: {addressLines.join(", ")}
                </Text>
              ) : null}
              <Text style={styles.partyLine}>
                {labels.placeOfSupplyLabel}: {placeOfSupply}
              </Text>
              {vendor?.phone ? (
                <Text style={styles.partyLine}>
                  {labels.mobileLabel}: {vendor.phone}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.itemsHeadRow}>
            <View style={{ ...styles.th, ...styles.colSno }}><Text>{labels.snoLabel}</Text></View>
            <View style={{ ...styles.th, ...styles.colItems }}><Text>
              {labels.itemsLabel}
            </Text></View>
            <View style={{ ...styles.th, ...styles.colQty }}><Text>{labels.qtyLabel}</Text></View>
            <View style={{ ...styles.th, ...styles.colRate }}><Text>{labels.rateLabel}</Text></View>
            <View style={{ ...styles.th, ...styles.colAmount }}><Text>
              {labels.amountLabel}
            </Text></View>
          </View>
          {lineItems.map((line, index) => {
            const { name, sublines } = splitDescription(line.description)
            return (
              <View key={line.id} style={styles.itemsRow}>
                <View style={{ ...styles.td, ...styles.colSno }}><Text>{index + 1}</Text></View>
                <View style={{ ...styles.td, ...styles.colItems }}>
                  <Text>{name}</Text>
                  {sublines.map((sub, i) => (
                    <Text key={i} style={styles.subline}>
                      {sub}
                    </Text>
                  ))}
                </View>
                <View style={{ ...styles.td, ...styles.colQty }}><Text>
                  {line.quantity} {labels.unitAbbrev}
                </Text></View>
                <View style={{ ...styles.td, ...styles.colRate }}><Text>
                  {num(line.unit_cost)}
                </Text></View>
                <View style={{ ...styles.td, ...styles.colAmount }}><Text>
                  {num(line.line_subtotal)}
                </Text></View>
              </View>
            )
          })}
          {isInterState ? (
            <View style={styles.taxSummaryRow}>
              <View style={styles.taxLabelCell}><Text>{labels.igstLabel}</Text></View>
              <View style={styles.taxAmountCell}><Text>{money(igst)}</Text></View>
            </View>
          ) : (
            <>
              <View style={styles.taxSummaryRow}>
                <View style={styles.taxLabelCell}><Text>{labels.cgstLabel}</Text></View>
                <View style={styles.taxAmountCell}><Text>{money(cgst)}</Text></View>
              </View>
              <View style={styles.taxSummaryRow}>
                <View style={styles.taxLabelCell}><Text>{labels.sgstLabel}</Text></View>
                <View style={styles.taxAmountCell}><Text>{money(sgst)}</Text></View>
              </View>
            </>
          )}
          {bill.round_off_amount !== 0 ? (
            <View style={styles.taxSummaryRow}>
              <View style={styles.roundOffCell}><Text>{labels.roundOffLabel}</Text></View>
              <View style={styles.roundOffAmountCell}><Text>
                {bill.round_off_amount > 0 ? "+" : "−"}
                {money(Math.abs(bill.round_off_amount))}
              </Text></View>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <View style={styles.totalLabelCell}><Text>{labels.totalLabel}</Text></View>
            <View style={styles.totalQtyCell}><Text>{totalQty}</Text></View>
            <View style={styles.totalAmountCell}><Text>{money(bill.total)}</Text></View>
          </View>

          {isInterState ? (
            <>
              <View style={styles.hsnHeadRow}>
                <View style={{ ...styles.hsnTh, ...styles.colHsn }}><Text>
                  {labels.hsnSacLabel}
                </Text></View>
                <View style={{ ...styles.hsnTh, ...styles.colTaxable }}><Text>
                  {labels.taxableValueLabel}
                </Text></View>
                <View style={{ ...styles.hsnTh, width: "18%" }}><Text>
                  {labels.igstColumnLabel} {labels.rateColumnLabel}
                </Text></View>
                <View style={{ ...styles.hsnTh, width: "26%" }}><Text>
                  {labels.igstColumnLabel} {labels.amountColumnLabel}
                </Text></View>
                <View style={{ ...styles.hsnTh, ...styles.colTotalTax }}><Text>
                  {labels.totalTaxAmountLabel}
                </Text></View>
              </View>
              {hsnRows.map((row) => (
                <View key={row.hsnSac + row.rate} style={styles.hsnRow}>
                  <View style={{ ...styles.hsnTd, ...styles.colHsn }}><Text>
                    {row.hsnSac}
                  </Text></View>
                  <View style={{ ...styles.hsnTd, ...styles.colTaxable }}><Text>
                    {num(row.taxable)}
                  </Text></View>
                  <View style={{ ...styles.hsnTd, width: "18%" }}><Text>
                    {formatRate(row.rate)}%
                  </Text></View>
                  <View style={{ ...styles.hsnTd, width: "26%" }}><Text>
                    {num(row.tax)}
                  </Text></View>
                  <View style={{ ...styles.hsnTd, ...styles.colTotalTax }}><Text>
                    {num(row.tax)}
                  </Text></View>
                </View>
              ))}
              <View style={{ ...styles.hsnRow, backgroundColor: PANEL }}>
                <View
                  style={{ ...styles.hsnTd, ...styles.colHsn, fontWeight: 700 }}
                ><Text>
                  {labels.totalLabel}
                </Text></View>
                <View
                  style={{ ...styles.hsnTd, ...styles.colTaxable, fontWeight: 700 }}
                ><Text>
                  {num(bill.subtotal)}
                </Text></View>
                <View style={{ ...styles.hsnTd, width: "18%" }} />
                <View style={{ ...styles.hsnTd, width: "26%", fontWeight: 700 }}><Text>
                  {num(igst)}
                </Text></View>
                <View
                  style={{ ...styles.hsnTd, ...styles.colTotalTax, fontWeight: 700 }}
                ><Text>
                  {num(bill.tax_total)}
                </Text></View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.hsnHeadRow}>
                <View style={{ ...styles.hsnTh, ...styles.colHsn }}><Text>
                  {labels.hsnSacLabel}
                </Text></View>
                <View style={{ ...styles.hsnTh, ...styles.colTaxable }}><Text>
                  {labels.taxableValueLabel}
                </Text></View>
                <View style={{ ...styles.hsnTh, ...styles.colRate2 }}><Text>
                  {labels.cgstColumnLabel} {labels.rateColumnLabel}
                </Text></View>
                <View style={{ ...styles.hsnTh, ...styles.colTaxAmt }}><Text>
                  {labels.cgstColumnLabel} {labels.amountColumnLabel}
                </Text></View>
                <View style={{ ...styles.hsnTh, ...styles.colRate2 }}><Text>
                  {labels.sgstColumnLabel} {labels.rateColumnLabel}
                </Text></View>
                <View style={{ ...styles.hsnTh, ...styles.colTaxAmt }}><Text>
                  {labels.sgstColumnLabel} {labels.amountColumnLabel}
                </Text></View>
                <View style={{ ...styles.hsnTh, ...styles.colTotalTax }}><Text>
                  {labels.totalTaxAmountLabel}
                </Text></View>
              </View>
              {hsnRows.map((row) => (
                <View key={row.hsnSac + row.rate} style={styles.hsnRow}>
                  <View style={{ ...styles.hsnTd, ...styles.colHsn }}><Text>
                    {row.hsnSac}
                  </Text></View>
                  <View style={{ ...styles.hsnTd, ...styles.colTaxable }}><Text>
                    {num(row.taxable)}
                  </Text></View>
                  <View style={{ ...styles.hsnTd, ...styles.colRate2 }}><Text>
                    {formatRate(row.rate / 2)}%
                  </Text></View>
                  <View style={{ ...styles.hsnTd, ...styles.colTaxAmt }}><Text>
                    {num(row.tax / 2)}
                  </Text></View>
                  <View style={{ ...styles.hsnTd, ...styles.colRate2 }}><Text>
                    {formatRate(row.rate / 2)}%
                  </Text></View>
                  <View style={{ ...styles.hsnTd, ...styles.colTaxAmt }}><Text>
                    {num(row.tax / 2)}
                  </Text></View>
                  <View style={{ ...styles.hsnTd, ...styles.colTotalTax }}><Text>
                    {num(row.tax)}
                  </Text></View>
                </View>
              ))}
              <View style={{ ...styles.hsnRow, backgroundColor: PANEL }}>
                <View
                  style={{ ...styles.hsnTd, ...styles.colHsn, fontWeight: 700 }}
                ><Text>
                  {labels.totalLabel}
                </Text></View>
                <View
                  style={{ ...styles.hsnTd, ...styles.colTaxable, fontWeight: 700 }}
                ><Text>
                  {num(bill.subtotal)}
                </Text></View>
                <View style={{ ...styles.hsnTd, ...styles.colRate2 }} />
                <View
                  style={{ ...styles.hsnTd, ...styles.colTaxAmt, fontWeight: 700 }}
                ><Text>
                  {num(cgst)}
                </Text></View>
                <View style={{ ...styles.hsnTd, ...styles.colRate2 }} />
                <View
                  style={{ ...styles.hsnTd, ...styles.colTaxAmt, fontWeight: 700 }}
                ><Text>
                  {num(sgst)}
                </Text></View>
                <View
                  style={{ ...styles.hsnTd, ...styles.colTotalTax, fontWeight: 700 }}
                ><Text>
                  {num(bill.tax_total)}
                </Text></View>
              </View>
            </>
          )}

          <View style={styles.wordsBlock}>
            <Text style={styles.wordsLabel}>{labels.amountInWordsLabel}</Text>
            <Text style={styles.wordsValue}>
              {amountToWords(bill.total)}
            </Text>
          </View>

          <View style={styles.bankSignRow}>
            <View style={styles.bankBlock}>
              {bankAccount ? (
                <>
                  <Text style={styles.bankLabel}>
                    {labels.bankDetailsLabel}
                  </Text>
                  <Text style={styles.bankLine}>
                    {labels.accountHolderLabel}:{" "}
                    {bankAccount.account_holder_name}
                  </Text>
                  <Text style={styles.bankLine}>
                    {labels.bankNameLabel}: {bankAccount.bank_name}
                  </Text>
                  <Text style={styles.bankLine}>
                    {labels.accountNumberLabel}: {bankAccount.account_number}
                  </Text>
                  <Text style={styles.bankLine}>
                    {labels.ifscLabel}: {bankAccount.ifsc_code}
                  </Text>
                </>
              ) : null}
            </View>
            <View style={styles.signBlock}>
              {organization?.signature_image ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image
                  src={organization.signature_image}
                  style={styles.signatureImage}
                />
              ) : null}
              <Text style={styles.signText}>
                {labels.authorisedSignatoryLabel}
              </Text>
              <Text style={styles.signOrg}>{organization?.name ?? ""}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
