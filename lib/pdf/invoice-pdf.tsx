"use client"

import type { DocumentProps } from "@react-pdf/renderer"
import type { InvoicePdfLabels } from "@/components/invoice-pdf-document"
import type { Customer, Invoice, InvoiceItem, Item, Organization } from "@/lib/database/types"

type TFunc = (key: string, values?: Record<string, string | number | Date>) => string

/** Maps the InvoicePrint message namespace onto InvoicePdfDocument's labels
 * prop — shared so the POS's print-after-sale flow and the invoice detail
 * page's Print/Download buttons can never drift out of sync. */
export function buildInvoicePdfLabels(tPrint: TFunc, lineItems: InvoiceItem[]): InvoicePdfLabels {
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
  }
}

/** Dynamically imports InvoicePdfDocument (and, with it, @react-pdf/renderer
 * plus the two ~650 KB embedded font files it registers at module load) so
 * that ~2.6 MB only downloads the first time a PDF is actually requested,
 * not on every visit to a page that merely has a Print/Download button. */
export async function buildInvoicePdfElement(params: {
  invoice: Invoice
  customer: Customer | undefined
  organization: Organization | undefined
  lineItems: InvoiceItem[]
  items: Item[] | undefined
  tPrint: TFunc
}): Promise<React.ReactElement<DocumentProps>> {
  const { InvoicePdfDocument } = await import("@/components/invoice-pdf-document")
  return (
    <InvoicePdfDocument
      invoice={params.invoice}
      customer={params.customer}
      organization={params.organization}
      lineItems={params.lineItems}
      items={params.items}
      labels={buildInvoicePdfLabels(params.tPrint, params.lineItems)}
    />
  ) as React.ReactElement<DocumentProps>
}

/** Renders a react-pdf element to an actual PDF file client-side (not a
 * browser print-to-PDF) and downloads it — pixel-accurate layout and real
 * embedded fonts/colors regardless of the browser's print settings. */
export async function downloadInvoicePdf(element: React.ReactElement<DocumentProps>, filename: string) {
  const { pdf } = await import("@react-pdf/renderer")
  const blob = await pdf(element).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Same generated PDF, but opened straight into the browser's print dialog
 * via a hidden iframe instead of downloading — one action to print, no
 * intermediate "open the file, then print" step. */
export async function printInvoicePdf(element: React.ReactElement<DocumentProps>) {
  const { pdf } = await import("@react-pdf/renderer")
  const blob = await pdf(element).toBlob()
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  iframe.src = url
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  }
  document.body.appendChild(iframe)
  // Cleanup once the print dialog has had time to open — there's no
  // reliable "print dialog closed" event, so this is a generous fixed
  // delay rather than removing the iframe (and revoking the blob URL the
  // PDF is still being read from) too early.
  setTimeout(() => {
    document.body.removeChild(iframe)
    URL.revokeObjectURL(url)
  }, 60000)
}
