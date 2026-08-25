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
  useCreateDebitNoteItem,
  useDebitNoteItems,
  useDeleteDebitNoteItem,
} from "@/hooks/use-debit-note-items"
import { usePurchaseBillItems } from "@/hooks/use-purchase-bill-items"
import type { DebitNoteItem } from "@/lib/database/types"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function DebitNoteItemsSection({
  debitNoteId,
  purchaseBillId,
  editable,
}: {
  debitNoteId: string
  purchaseBillId: string
  editable: boolean
}) {
  const t = useTranslations("DebitNotes")
  const tBills = useTranslations("PurchaseBills")
  const tCommon = useTranslations("Common")

  const { data: billLines } = usePurchaseBillItems(purchaseBillId)
  const { data: returnLines } = useDebitNoteItems(debitNoteId)
  const createReturnLine = useCreateDebitNoteItem()
  const deleteReturnLine = useDeleteDebitNoteItem(debitNoteId)

  const [toDelete, setToDelete] = useState<DebitNoteItem | null>(null)
  const [pendingQty, setPendingQty] = useState<Record<string, number>>({})

  const returnedByBillLine = new Map<string, number>()
  returnLines?.forEach((line) => {
    if (!line.purchase_bill_item_id) return
    returnedByBillLine.set(line.purchase_bill_item_id, (returnedByBillLine.get(line.purchase_bill_item_id) ?? 0) + line.quantity)
  })

  function addReturnLine(billLineId: string) {
    const billLine = billLines?.find((l) => l.id === billLineId)
    if (!billLine) return
    const alreadyReturned = returnedByBillLine.get(billLineId) ?? 0
    const remaining = billLine.quantity - alreadyReturned
    const quantity = pendingQty[billLineId] ?? remaining
    if (quantity <= 0 || quantity > remaining) return

    createReturnLine.mutate(
      {
        debit_note_id: debitNoteId,
        purchase_bill_item_id: billLine.id,
        item_id: billLine.item_id,
        description: billLine.description,
        quantity,
        unit_cost: billLine.unit_cost,
        tax_rate: billLine.tax_rate,
      },
      {
        onSuccess: () => toast.success(tCommon("createdSuccess")),
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  const availableLines = billLines?.filter((line) => (returnedByBillLine.get(line.id) ?? 0) < line.quantity) ?? []

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
                <TableHead>{tBills("descriptionLabel")}</TableHead>
                <TableHead className="text-right">{tBills("quantityLabel")}</TableHead>
                <TableHead className="text-right">{tBills("unitCostLabel")}</TableHead>
                <TableHead className="text-right">{tBills("lineTotalLabel")}</TableHead>
                {editable ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {returnLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">{money(line.unit_cost)}</TableCell>
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
                const alreadyReturned = returnedByBillLine.get(line.id) ?? 0
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
