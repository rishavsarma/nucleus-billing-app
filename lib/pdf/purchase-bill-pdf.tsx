"use client"

import type { PurchaseBillPdfLabels } from "@/components/purchase-bill-pdf-document"
import type {
  Item,
  Organization,
  OrganizationBankAccount,
  PurchaseBill,
  PurchaseBillItem,
  Vendor,
} from "@/lib/database/types"
import { downloadPdf, renderPdfObjectUrl } from "./render"

type TFunc = (
  key: string,
  values?: Record<string, string | number | Date>
) => string

/** Maps the PurchaseBillPrint message namespace onto PurchaseBillPdfDocument's
 * labels prop — the vendor-side counterpart of buildInvoicePdfLabels. */
export function buildPurchaseBillPdfLabels(
  tPrint: TFunc,
  lineItems: PurchaseBillItem[]
): PurchaseBillPdfLabels {
  return {
    purchaseBill: tPrint("purchaseBill"),
    gstinLabel: tPrint("gstinLabel"),
    panLabel: tPrint("panLabel"),
    mobileLabel: tPrint("mobileLabel"),
    billNoLabel: tPrint("billNoLabel"),
    vendorInvoiceNoLabel: tPrint("vendorInvoiceNoLabel"),
    billDateLabel: tPrint("billDateLabel"),
    vendorLabel: tPrint("vendorLabel"),
    addressLabel: tPrint("addressLabel"),
    placeOfSupplyLabel: tPrint("placeOfSupplyLabel"),
    snoLabel: tPrint("snoLabel"),
    itemsLabel: tPrint("itemsLabel"),
    qtyLabel: tPrint("qtyLabel"),
    rateLabel: tPrint("rateLabel"),
    amountLabel: tPrint("amountLabel"),
    unitAbbrev: tPrint("unitAbbrev"),
    cgstLabel: tPrint("cgstLabel", { rate: (lineItems[0]?.tax_rate ?? 0) / 2 }),
    sgstLabel: tPrint("sgstLabel", { rate: (lineItems[0]?.tax_rate ?? 0) / 2 }),
    igstLabel: tPrint("igstLabel", { rate: lineItems[0]?.tax_rate ?? 0 }),
    totalLabel: tPrint("totalLabel"),
    hsnSacLabel: tPrint("hsnSacLabel"),
    taxableValueLabel: tPrint("taxableValueLabel"),
    cgstColumnLabel: tPrint("cgstColumnLabel"),
    sgstColumnLabel: tPrint("sgstColumnLabel"),
    igstColumnLabel: tPrint("igstColumnLabel"),
    rateColumnLabel: tPrint("rateColumnLabel"),
    amountColumnLabel: tPrint("amountColumnLabel"),
    totalTaxAmountLabel: tPrint("totalTaxAmountLabel"),
    amountInWordsLabel: tPrint("amountInWordsLabel"),
    authorisedSignatoryLabel: tPrint("authorisedSignatoryLabel"),
    roundOffLabel: tPrint("roundOffLabel"),
    bankDetailsLabel: tPrint("bankDetailsLabel"),
    accountHolderLabel: tPrint("accountHolderLabel"),
    accountNumberLabel: tPrint("accountNumberLabel"),
    ifscLabel: tPrint("ifscLabel"),
    bankNameLabel: tPrint("bankNameLabel"),
  }
}

/** Dynamically imports PurchaseBillPdfDocument (and, with it, @formepdf/react
 * and the font registrations) so none of it downloads on a page that merely
 * has a Preview/Download button. The WASM renderer is deferred separately in
 * lib/pdf/render.ts. */
export async function buildPurchaseBillPdfElement(params: {
  bill: PurchaseBill
  vendor: Vendor | undefined
  organization: Organization | undefined
  lineItems: PurchaseBillItem[]
  items: Item[] | undefined
  bankAccount?: OrganizationBankAccount | null
  tPrint: TFunc
  watermarkText?: string | null
}): Promise<React.ReactElement> {
  const { PurchaseBillPdfDocument } = await import(
    "@/components/purchase-bill-pdf-document"
  )
  return (
    <PurchaseBillPdfDocument
      bill={params.bill}
      vendor={params.vendor}
      organization={params.organization}
      lineItems={params.lineItems}
      items={params.items}
      bankAccount={params.bankAccount}
      labels={buildPurchaseBillPdfLabels(params.tPrint, params.lineItems)}
      watermarkText={
        params.watermarkText ?? params.organization?.pdf_watermark_text
      }
    />
  )
}

export async function downloadPurchaseBillPdf(
  element: React.ReactElement,
  filename: string
) {
  await downloadPdf(element, filename)
}

/** Caller owns the returned object URL and must revoke it — see render.ts. */
export async function previewPurchaseBillPdf(
  element: React.ReactElement
): Promise<string> {
  return renderPdfObjectUrl(element)
}
