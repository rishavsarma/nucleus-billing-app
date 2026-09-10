"use client"

import type { InvoicePdfLabels } from "@/components/invoice-pdf-document"
import type {
  Customer,
  Invoice,
  InvoiceItem,
  Item,
  Organization,
  OrganizationBankAccount,
} from "@/lib/database/types"
import { downloadPdf, renderPdfObjectUrl } from "./render"

type TFunc = (
  key: string,
  values?: Record<string, string | number | Date>
) => string

/** Maps the InvoicePrint message namespace onto InvoicePdfDocument's labels
 * prop — shared so the POS's print-after-sale flow and the invoice detail
 * page's Print/Download buttons can never drift out of sync. */
export function buildInvoicePdfLabels(
  tPrint: TFunc,
  lineItems: InvoiceItem[]
): InvoicePdfLabels {
  return {
    taxInvoice: tPrint("taxInvoice"),
    originalForRecipient: tPrint("originalForRecipient"),
    gstinLabel: tPrint("gstinLabel"),
    panLabel: tPrint("panLabel"),
    mobileLabel: tPrint("mobileLabel"),
    invoiceNoLabel: tPrint("invoiceNoLabel"),
    invoiceDateLabel: tPrint("invoiceDateLabel"),
    billToLabel: tPrint("billToLabel"),
    shipToLabel: tPrint("shipToLabel"),
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
    totalLabel: tPrint("totalLabel"),
    hsnSacLabel: tPrint("hsnSacLabel"),
    taxableValueLabel: tPrint("taxableValueLabel"),
    cgstColumnLabel: tPrint("cgstColumnLabel"),
    sgstColumnLabel: tPrint("sgstColumnLabel"),
    rateColumnLabel: tPrint("rateColumnLabel"),
    amountColumnLabel: tPrint("amountColumnLabel"),
    totalTaxAmountLabel: tPrint("totalTaxAmountLabel"),
    amountInWordsLabel: tPrint("amountInWordsLabel"),
    authorisedSignatoryLabel: tPrint("authorisedSignatoryLabel"),
    igstLabel: tPrint("igstLabel", { rate: lineItems[0]?.tax_rate ?? 0 }),
    igstColumnLabel: tPrint("igstColumnLabel"),
    roundOffLabel: tPrint("roundOffLabel"),
    bankDetailsLabel: tPrint("bankDetailsLabel"),
    accountHolderLabel: tPrint("accountHolderLabel"),
    accountNumberLabel: tPrint("accountNumberLabel"),
    ifscLabel: tPrint("ifscLabel"),
    bankNameLabel: tPrint("bankNameLabel"),
  }
}

/** Dynamically imports InvoicePdfDocument (and, with it, @formepdf/react and
 * the font registrations) so none of it downloads on a page that merely has a
 * Print/Download button — only when a PDF is actually requested. The heavy
 * part, the WASM renderer, is deferred separately in renderInvoiceBlob(). */
export async function buildInvoicePdfElement(params: {
  invoice: Invoice
  customer: Customer | undefined
  organization: Organization | undefined
  lineItems: InvoiceItem[]
  items: Item[] | undefined
  /** The invoice's linked bank account (resolved by the caller via
   * useOrganizationBankAccounts(), since this function has no hook access),
   * printed on the invoice when set. */
  bankAccount?: OrganizationBankAccount | null
  tPrint: TFunc
  /** Today's active date-range preset text (resolved by the caller via
   * useActivePdfWatermarkText(), since this function has no hook access),
   * falling back to organization.pdf_watermark_text when no preset is
   * currently active. */
  watermarkText?: string | null
}): Promise<React.ReactElement> {
  const { InvoicePdfDocument } =
    await import("@/components/invoice-pdf-document")
  return (
    <InvoicePdfDocument
      invoice={params.invoice}
      customer={params.customer}
      organization={params.organization}
      lineItems={params.lineItems}
      items={params.items}
      bankAccount={params.bankAccount}
      labels={buildInvoicePdfLabels(params.tPrint, params.lineItems)}
      watermarkText={
        params.watermarkText ?? params.organization?.pdf_watermark_text
      }
    />
  )
}

/** Renders the invoice to an actual PDF file client-side (not a browser
 * print-to-PDF) and downloads it — pixel-accurate layout and real embedded
 * fonts/colors regardless of the browser's print settings. */
export async function downloadInvoicePdf(
  element: React.ReactElement,
  filename: string
) {
  await downloadPdf(element, filename)
}

/** Renders to an object URL for the in-app preview dialog. Caller owns the
 * URL and must revoke it — see lib/pdf/render.ts. */
export async function previewInvoicePdf(
  element: React.ReactElement
): Promise<string> {
  return renderPdfObjectUrl(element)
}
