"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { EntityFormDialog } from "@/components/entity-form-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  useCreateDebitNoteItem,
  useDebitNoteItems,
  useDeleteDebitNoteItem,
  useUpdateDebitNoteItem,
} from "@/hooks/use-debit-note-items"
import type { DebitNoteItem } from "@/lib/database/types"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const lineItemSchema = z.object({
  description: z.string().min(1),
  amount: z.number(),
  tax_rate: z.number().min(0).max(100),
})
type LineItemFormValues = z.infer<typeof lineItemSchema>

export function DebitNoteItemsSection({ debitNoteId, editable }: { debitNoteId: string; editable: boolean }) {
  const t = useTranslations("DebitNotes")
  const tCommon = useTranslations("Common")

  const { data: lineItems } = useDebitNoteItems(debitNoteId)
  const createLineItem = useCreateDebitNoteItem()
  const updateLineItem = useUpdateDebitNoteItem(debitNoteId)
  const deleteLineItem = useDeleteDebitNoteItem(debitNoteId)

  const [editing, setEditing] = useState<DebitNoteItem | "new" | null>(null)
  const [toDelete, setToDelete] = useState<DebitNoteItem | null>(null)

  const form = useForm<LineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    values:
      editing && editing !== "new"
        ? { description: editing.description, amount: editing.amount, tax_rate: editing.tax_rate }
        : { description: "", amount: 0, tax_rate: 0 },
  })

  function onSubmit(values: LineItemFormValues) {
    if (editing && editing !== "new") {
      updateLineItem.mutate(
        { id: editing.id, input: values },
        {
          onSuccess: () => {
            toast.success(tCommon("updatedSuccess"))
            setEditing(null)
          },
          onError: () => toast.error(tCommon("genericError")),
        },
      )
    } else {
      createLineItem.mutate(
        { ...values, debit_note_id: debitNoteId },
        {
          onSuccess: () => {
            toast.success(tCommon("createdSuccess"))
            setEditing(null)
          },
          onError: () => toast.error(tCommon("genericError")),
        },
      )
    }
  }

  const isSaving = createLineItem.isPending || updateLineItem.isPending

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t("lineItemsTitle")}</h2>
        {editable ? (
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <PlusIcon />
            {t("addLineItem")}
          </Button>
        ) : null}
      </div>
      <div className="p-3 sm:p-4 overflow-x-auto">
        {lineItems?.length ? (
          <Table className="whitespace-nowrap text-xs sm:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>{t("descriptionLabel")}</TableHead>
                <TableHead className="text-right">{t("amountLabel")}</TableHead>
                <TableHead className="text-right">{t("taxRateLabel")}</TableHead>
                <TableHead className="text-right">{t("lineTotalLabel")}</TableHead>
                {editable ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{line.description}</TableCell>
                  <TableCell className="text-right">{money(line.amount)}</TableCell>
                  <TableCell className="text-right">{line.tax_rate}%</TableCell>
                  <TableCell className="text-right font-semibold">{money(line.line_total)}</TableCell>
                  {editable ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(line)}>
                          <PencilIcon />
                        </Button>
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
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("noLineItems")}</p>
        )}
      </div>

      <EntityFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={t("addLineItem")}
        onSubmit={form.handleSubmit(onSubmit)}
        isSubmitting={isSaving}
        submitLabel={editing !== "new" ? tCommon("save") : tCommon("create")}
      >
        <Field>
          <FieldLabel htmlFor="dni-description">{t("descriptionLabel")}</FieldLabel>
          <Input id="dni-description" {...form.register("description")} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field>
            <FieldLabel htmlFor="dni-amount">{t("amountLabel")}</FieldLabel>
            <Input id="dni-amount" type="number" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="dni-tax-rate">{t("taxRateLabel")}</FieldLabel>
            <Input id="dni-tax-rate" type="number" step="0.01" min={0} max={100} {...form.register("tax_rate", { valueAsNumber: true })} />
          </Field>
        </div>
      </EntityFormDialog>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteLineItem.isPending}
        onConfirm={() => {
          if (!toDelete) return
          deleteLineItem.mutate(toDelete.id, {
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
