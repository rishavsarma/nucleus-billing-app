"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon, CheckIcon, XIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { DebitNoteItemsSection } from "@/components/debit-note-items-section"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { DocumentStepper, type StepperStep } from "@/components/document-stepper"
import { StatusBadge } from "@/components/status-badge"
import { useVendors } from "@/hooks/use-vendors"
import { useDebitNotes, useUpdateDebitNote } from "@/hooks/use-debit-notes"
import { usePurchaseBills } from "@/hooks/use-purchase-bills"
import { useWarehouses } from "@/hooks/use-warehouses"
import { routes } from "@/lib/routes"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function DebitNoteDetailClient({ id }: { id: string }) {
  const t = useTranslations("DebitNotes")
  const tStatus = useTranslations("DocStatus")
  const tCommon = useTranslations("Common")

  const { data: debitNotes, isLoading } = useDebitNotes()
  const { data: vendors } = useVendors()
  const { data: bills } = usePurchaseBills()
  const { data: warehouses } = useWarehouses()
  const updateDebitNote = useUpdateDebitNote()
  const [confirmVoid, setConfirmVoid] = useState(false)

  const debitNote = debitNotes?.find((dn) => dn.id === id)

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
  }

  if (!debitNote) {
    return (
      <div className="flex flex-col gap-2">
        <Link href={routes.purchases.debitNotes.list} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          {t("backToList")}
        </Link>
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
      </div>
    )
  }

  const vendor = vendors?.find((v) => v.id === debitNote.vendor_id)
  const originalBill = bills?.find((b) => b.id === debitNote.purchase_bill_id)
  const warehouse = warehouses?.find((w) => w.id === debitNote.warehouse_id)
  const isDraft = debitNote.status === "draft"
  const isVoid = debitNote.status === "void"

  const steps: StepperStep[] = [
    { label: t("stepDraft"), done: !isDraft, current: isDraft },
    { label: t("stepIssued"), done: false, current: !isDraft },
  ]

  function issueDebitNote() {
    updateDebitNote.mutate(
      { id, input: { status: "issued" } },
      {
        onSuccess: () => toast.success(tCommon("updatedSuccess")),
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  function voidDebitNote() {
    updateDebitNote.mutate(
      { id, input: { status: "void" } },
      {
        onSuccess: () => {
          toast.success(tCommon("updatedSuccess"))
          setConfirmVoid(false)
        },
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Link href={routes.purchases.debitNotes.list} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold">{debitNote.debit_note_number ?? "—"}</h1>
            <StatusBadge status={debitNote.status}>{tStatus(debitNote.status)}</StatusBadge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("columnBill")} {originalBill?.bill_number ?? "—"} • {vendor?.name ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDraft ? (
            <Button onClick={issueDebitNote} disabled={updateDebitNote.isPending}>
              <CheckIcon />
              {t("issueDebitNote")}
            </Button>
          ) : null}
          {!isVoid ? (
            <Button variant="destructive" size="icon" onClick={() => setConfirmVoid(true)} title={t("voidDebitNote")}>
              <XIcon />
            </Button>
          ) : null}
        </div>
      </div>

      {!isVoid ? (
        <div className="mb-5">
          <DocumentStepper steps={steps} />
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 flex flex-col gap-5">
          <DebitNoteItemsSection debitNoteId={id} purchaseBillId={debitNote.purchase_bill_id} editable={isDraft} />
          {debitNote.reason ? (
            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="mb-2 text-sm font-semibold">{t("reasonLabel")}</h2>
              <p className="text-sm text-muted-foreground">{debitNote.reason}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 text-sm font-semibold">{t("summaryTitle")}</h2>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotalLabel")}</span>
                <span>{money(debitNote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("taxLabel")}</span>
                <span>{money(debitNote.tax_total)}</span>
              </div>
              <div className="my-1.5 border-t" />
              <div className="flex justify-between text-base font-semibold">
                <span>{t("totalDebitLabel")}</span>
                <span>{money(debitNote.total)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-2 text-sm font-semibold">{t("destockingTitle")}</h2>
            <p className="text-xs text-muted-foreground">
              {warehouse ? `${t("destockingNote")} (${warehouse.name})` : t("destockingNote")}
            </p>
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        open={confirmVoid}
        onOpenChange={setConfirmVoid}
        isDeleting={updateDebitNote.isPending}
        title={t("voidConfirmTitle")}
        description={t("voidConfirmDescription")}
        onConfirm={voidDebitNote}
      />
    </div>
  )
}
