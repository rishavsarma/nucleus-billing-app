"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PlusIcon, TrashIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  useCreateCreditNoteItem,
  useCreditNoteItems,
  useDeleteCreditNoteItem,
} from "@/hooks/use-credit-note-items"
import { useInvoiceItems } from "@/hooks/use-invoice-items"
import type { CreditNoteItem } from "@/lib/database/types"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function CreditNoteItemsSection({
  creditNoteId,
  invoiceId,
  editable,
}: {
  creditNoteId: string
  invoiceId: string
  editable: boolean
}) {
  const t = useTranslations("CreditNotes")
  const tInvoices = useTranslations("Invoices")
  const tCommon = useTranslations("Common")

  const { data: invoiceLines } = useInvoiceItems(invoiceId)
  const { data: returnLines } = useCreditNoteItems(creditNoteId)
  const createReturnLine = useCreateCreditNoteItem()
  const deleteReturnLine = useDeleteCreditNoteItem(creditNoteId)

  const [toDelete, setToDelete] = useState<CreditNoteItem | null>(null)
  const [pendingQty, setPendingQty] = useState<Record<string, number>>({})

  const returnedByInvoiceLine = new Map<string, number>()
  returnLines?.forEach((line) => {
    if (!line.invoice_item_id) return
    returnedByInvoiceLine.set(line.invoice_item_id, (returnedByInvoiceLine.get(line.invoice_item_id) ?? 0) + line.quantity)
  })

  function addReturnLine(invoiceLineId: string) {
    const invoiceLine = invoiceLines?.find((l) => l.id === invoiceLineId)
    if (!invoiceLine) return
    const alreadyReturned = returnedByInvoiceLine.get(invoiceLineId) ?? 0
    const remaining = invoiceLine.quantity - alreadyReturned
    const quantity = pendingQty[invoiceLineId] ?? remaining
    if (quantity <= 0 || quantity > remaining) return

    createReturnLine.mutate(
      {
        credit_note_id: creditNoteId,
        invoice_item_id: invoiceLine.id,
        item_id: invoiceLine.item_id,
        description: invoiceLine.description,
        quantity,
        unit_price: invoiceLine.unit_price,
        tax_rate: invoiceLine.tax_rate,
      },
      {
        onSuccess: () => toast.success(tCommon("createdSuccess")),
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  const availableLines =
    invoiceLines?.filter((line) => (returnedByInvoiceLine.get(line.id) ?? 0) < line.quantity) ?? []

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t("returnItemsTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("returnItemsDescription")}</p>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {returnLines?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tInvoices("descriptionLabel")}</TableHead>
                <TableHead className="text-right">{tInvoices("quantityLabel")}</TableHead>
                <TableHead className="text-right">{tInvoices("unitPriceLabel")}</TableHead>
                <TableHead className="text-right">{tInvoices("lineTotalLabel")}</TableHead>
                {editable ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {returnLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">{money(line.unit_price)}</TableCell>
                  <TableCell className="text-right font-medium">{money(line.line_total)}</TableCell>
                  {editable ? (
                    <TableCell>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon-sm" onClick={() => setToDelete(line)}>
                          <TrashIcon />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}

        {editable ? (
          availableLines.length ? (
            <div className="flex flex-col gap-2">
              {availableLines.map((line) => {
                const alreadyReturned = returnedByInvoiceLine.get(line.id) ?? 0
                const remaining = line.quantity - alreadyReturned
                return (
                  <div key={line.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <div className="flex-1">
                      <div className="text-sm">{line.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("maxReturnableNote", { qty: remaining, total: line.quantity })}
                      </div>
                    </div>
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      max={remaining}
                      defaultValue={remaining}
                      className="w-24"
                      onChange={(e) => setPendingQty((prev) => ({ ...prev, [line.id]: Number(e.target.value) }))}
                    />
                    <Button size="sm" variant="outline" onClick={() => addReturnLine(line.id)} disabled={createReturnLine.isPending}>
                      <PlusIcon />
                      {t("addReturnLine")}
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : returnLines?.length ? (
            <p className="text-center text-sm text-muted-foreground">{t("noReturnableItems")}</p>
          ) : null
        ) : null}

        {!returnLines?.length && !availableLines.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("noReturnableItems")}</p>
        ) : null}
      </div>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteReturnLine.isPending}
        onConfirm={() => {
          if (!toDelete) return
          deleteReturnLine.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(tCommon("deletedSuccess"))
              setToDelete(null)
            },
            onError: () => toast.error(tCommon("genericError")),
          })
        }}
      />
    </div>
  )
}
