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
  useCreateCreditNoteItem,
  useCreditNoteItems,
  useDeleteCreditNoteItem,
  useUpdateCreditNoteItem,
} from "@/hooks/use-credit-note-items"
import type { CreditNoteItem } from "@/lib/database/types"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const lineItemSchema = z.object({
  description: z.string().min(1),
  amount: z.number(),
  tax_rate: z.number().min(0).max(100),
})
type LineItemFormValues = z.infer<typeof lineItemSchema>

export function CreditNoteItemsSection({ creditNoteId, editable }: { creditNoteId: string; editable: boolean }) {
  const t = useTranslations("CreditNotes")
  const tCommon = useTranslations("Common")

  const { data: lineItems } = useCreditNoteItems(creditNoteId)
  const createLineItem = useCreateCreditNoteItem()
  const updateLineItem = useUpdateCreditNoteItem(creditNoteId)
  const deleteLineItem = useDeleteCreditNoteItem(creditNoteId)

  const [editing, setEditing] = useState<CreditNoteItem | "new" | null>(null)
  const [toDelete, setToDelete] = useState<CreditNoteItem | null>(null)

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
        { ...values, credit_note_id: creditNoteId },
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
      <div className="p-4">
        {lineItems?.length ? (
          <Table>
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
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right">{money(line.amount)}</TableCell>
                  <TableCell className="text-right">{line.tax_rate}%</TableCell>
                  <TableCell className="text-right font-medium">{money(line.line_total)}</TableCell>
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
          <FieldLabel htmlFor="cni-description">{t("descriptionLabel")}</FieldLabel>
          <Input id="cni-description" {...form.register("description")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="cni-amount">{t("amountLabel")}</FieldLabel>
            <Input id="cni-amount" type="number" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="cni-tax-rate">{t("taxRateLabel")}</FieldLabel>
            <Input id="cni-tax-rate" type="number" step="0.01" min={0} max={100} {...form.register("tax_rate", { valueAsNumber: true })} />
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
