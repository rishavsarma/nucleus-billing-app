"use client"

import { useEffect, useRef, useState } from "react"
import { isAxiosError } from "axios"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  BanknoteIcon,
  CreditCardIcon,
  LandmarkIcon,
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  SmartphoneIcon,
  TrashIcon,
  TruckIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CustomerSelect } from "@/components/customer-select"
import { OfferSelect } from "@/components/offer-select"
import { Input } from "@/components/ui/input"
import { QuickAddCustomerDialog } from "@/components/quick-add-customer-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { calculateOfferDiscount } from "@/lib/calculate-offer"
import { cn } from "@/lib/utils"
import { useCreateCustomer, useCustomers } from "@/hooks/use-customers"
import { useCreateDelivery, useDeliveryByInvoice, useUpdateDelivery } from "@/hooks/use-deliveries"
import { useDeliveryPersons } from "@/hooks/use-delivery-persons"
import { fetchInvoiceItems } from "@/lib/database/services/invoice-items"
import { fetchInvoiceById } from "@/lib/database/services/invoices"
import { useCreateInvoiceItem, useDeleteInvoiceItem, useInvoiceItems, useUpdateInvoiceItem } from "@/hooks/use-invoice-items"
import { useCreateInvoice, useInvoices, useUpdateInvoice } from "@/hooks/use-invoices"
import { useItems } from "@/hooks/use-items"
import { useItemVariantsBulk } from "@/hooks/use-item-variants"
import { useOffers } from "@/hooks/use-offers"
import { useOrganizations } from "@/hooks/use-organizations"
import { useCreatePayment } from "@/hooks/use-payments"
import { useTaxRates } from "@/hooks/use-tax-rates"
import { useWarehouses } from "@/hooks/use-warehouses"
import { buildInvoicePdfElement, printInvoicePdf } from "@/lib/pdf/invoice-pdf"
import type { Item, ItemVariant, Payment } from "@/lib/database/types"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// "Card" (the label shown) maps to the real "razorpay" method — the schema
// has no literal "card" value; razorpay is the card/online-processor option.
const PAYMENT_METHODS = ["cash", "razorpay", "upi", "bank_transfer"] as const
const PAYMENT_METHOD_ICONS: Record<string, typeof BanknoteIcon> = {
  cash: BanknoteIcon,
  razorpay: CreditCardIcon,
  upi: SmartphoneIcon,
  bank_transfer: LandmarkIcon,
}

// Not translated: this is a data value stored as a real customers.name row
// (matched by exact string below), not UI copy — translating it would create
// a separate "Guest Customer" per locale instead of one reusable row per org.
const GUEST_CUSTOMER_NAME = "Guest Customer"

type CartLine = {
  tempId: string
  itemId: string | null
  itemVariantId: string | null
  // "item" = a real catalog item. "charge"/"discount" = a manual no-item
  // line (delivery fee, additional charge, or a manual discount) — same
  // nullable-item_id mechanism purchase bills already use for custom lines.
  // A discount line's unitPrice is stored negative (the sign IS the
  // discriminator once saved server-side, since invoice_items has no
  // separate "kind" column); the UI always displays its magnitude.
  kind: "item" | "charge" | "discount"
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
}

type DeliveryDraft = {
  enabled: boolean
  address: string
  deliveryPersonId: string | null
  paymentMode: "cod" | "prepaid" | null
}

type PosTab = {
  key: string
  invoiceId: string | null
  customerId: string | null
  warehouseId: string | null
  offerId: string | null
  notes: string
  paymentMethod: string
  paymentAmount: number | null
  lines: CartLine[]
  delivery: DeliveryDraft
}

function newTab(): PosTab {
  return {
    key: crypto.randomUUID(),
    invoiceId: null,
    customerId: null,
    warehouseId: null,
    offerId: null,
    notes: "",
    paymentMethod: PAYMENT_METHODS[0],
    paymentAmount: null,
    lines: [],
    delivery: { enabled: false, address: "", deliveryPersonId: null, paymentMode: null },
  }
}

function lineTotals(lines: CartLine[]) {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  const tax = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice * l.taxRate) / 100, 0)
  return { subtotal, tax, total: subtotal + tax }
}

/** Small bordered qty stepper used on every cart row — replaces plain +/- ghost buttons with a single connected control. */
function QtyStepper({ value, onDecrement, onIncrement }: { value: number; onDecrement: () => void; onIncrement: () => void }) {
  return (
    <div className="flex shrink-0 items-center overflow-hidden rounded-md border border-border">
      <button
        type="button"
        onClick={onDecrement}
        className="flex size-6 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MinusIcon className="size-3" />
      </button>
      <span className="w-6 text-center text-xs font-medium tabular-nums">{value}</span>
      <button
        type="button"
        onClick={onIncrement}
        className="flex size-6 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <PlusIcon className="size-3" />
      </button>
    </div>
  )
}

/** One catalog item's tile in the POS grid. Non-tracked items show their
 * plain price, one click = add/increment. Tracked items with a single
 * variant behave the same way. Tracked items with two or more variants show
 * each as its own clickable price chip, so the cashier picks explicitly
 * which purchase to sell from instead of the app guessing FIFO order. */
function ItemTile({
  item,
  variants,
  onAdd,
}: {
  item: Item
  variants: ItemVariant[] | undefined
  onAdd: (item: Item, variant?: ItemVariant) => void
}) {
  const t = useTranslations("BillingPos")
  const Icon = item.track_inventory ? PackageIcon : WrenchIcon

  if (!item.track_inventory) {
    return (
      <button
        type="button"
        onClick={() => onAdd(item)}
        className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="size-4" />
        </span>
        <span className="w-full min-w-0">
          <span className="block truncate text-sm font-medium">{item.name}</span>
          <span className="block text-xs text-muted-foreground">{money(item.unit_price)}</span>
        </span>
      </button>
    )
  }

  const availableVariants = (variants ?? []).filter((v) => v.quantity_remaining > 0)

  if (!availableVariants.length) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 opacity-50">
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <span className="w-full min-w-0">
          <span className="block truncate text-sm font-medium">{item.name}</span>
          <span className="block text-xs text-muted-foreground">{t("noStock")}</span>
        </span>
      </div>
    )
  }

  if (availableVariants.length === 1) {
    const variant = availableVariants[0]
    return (
      <button
        type="button"
        onClick={() => onAdd(item, variant)}
        className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="size-4" />
        </span>
        <span className="w-full min-w-0">
          <span className="block truncate text-sm font-medium">{item.name}</span>
          <span className="block text-xs text-muted-foreground">{money(variant.unit_price)}</span>
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3">
      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="block w-full min-w-0 truncate text-sm font-medium">{item.name}</span>
      <div className="flex flex-wrap gap-1">
        {availableVariants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            onClick={() => onAdd(item, variant)}
            className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            {t("variantChip", { price: money(variant.unit_price), qty: variant.quantity_remaining })}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function BillingPosPage() {
  const t = useTranslations("BillingPos")
  const tCommon = useTranslations("Common")
  const tPay = useTranslations("RecordPayment")
  const tMethods = useTranslations("PaymentMethods")
  const tDeliveryPaymentMode = useTranslations("DeliveryPaymentMode")
  const tPrint = useTranslations("InvoicePrint")

  const { data: items } = useItems()
  const { data: customers } = useCustomers()
  const { data: warehouses } = useWarehouses()
  const { data: taxRates } = useTaxRates()
  const { data: offers } = useOffers()
  const { data: invoices } = useInvoices()
  const { data: deliveryPersons } = useDeliveryPersons()
  const { data: organizations } = useOrganizations()
  const createInvoice = useCreateInvoice()
  const createInvoiceItem = useCreateInvoiceItem()
  const updateInvoiceItem = useUpdateInvoiceItem(undefined)
  const deleteInvoiceItem = useDeleteInvoiceItem(undefined)
  const updateInvoice = useUpdateInvoice()
  const createPayment = useCreatePayment()
  const createCustomer = useCreateCustomer()
  const createDelivery = useCreateDelivery()
  const updateDelivery = useUpdateDelivery()

  const [tabs, setTabs] = useState<PosTab[]>([newTab()])
  const [activeKey, setActiveKey] = useState(tabs[0].key)
  const [search, setSearch] = useState("")
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const posContainerRef = useRef<HTMLDivElement>(null)
  // A saved custom line's only persisted signal for "charge vs discount" is
  // the sign of its unit_price — but it starts at 0 (ambiguous) until the
  // cashier types an amount, and by then the description may have been
  // renamed away from the "Additional Charge"/"Discount" default. This map
  // bridges that gap: recorded once at creation, read only while the price
  // is still exactly 0.
  const [customLineKinds, setCustomLineKinds] = useState<Record<string, "charge" | "discount">>({})

  // True device-level fullscreen on just the POS workspace (not a CSS
  // "cover the viewport" trick) — the browser renders only this element
  // full-screen, so the app sidebar/topbar are hidden along with it.
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === posContainerRef.current)
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      posContainerRef.current?.requestFullscreen()
    }
  }

  const activeTab = tabs.find((tab) => tab.key === activeKey)!
  const activeInvoice = invoices?.find((inv) => inv.id === activeTab.invoiceId)
  const { data: savedCartItems } = useInvoiceItems(activeTab.invoiceId ?? undefined)
  const { data: existingDelivery } = useDeliveryByInvoice(activeTab.invoiceId ?? undefined)
  const isDraftSaved = !!activeTab.invoiceId

  const selectedOfferId = isDraftSaved ? (activeInvoice?.offer_id ?? null) : activeTab.offerId
  const selectedOffer = offers?.find((o) => o.id === selectedOfferId)

  const localTotals = lineTotals(activeTab.lines)
  const subtotal = isDraftSaved ? (activeInvoice?.subtotal ?? 0) : localTotals.subtotal
  const tax = isDraftSaved ? (activeInvoice?.tax_total ?? 0) : localTotals.tax
  const discount = isDraftSaved
    ? (activeInvoice?.discount_total ?? 0)
    : calculateOfferDiscount(selectedOffer, subtotal, tax)
  const total = isDraftSaved
    ? (activeInvoice?.total ?? 0)
    : Math.max(0, subtotal + tax - discount)
  const cartCount = isDraftSaved ? (savedCartItems?.length ?? 0) : activeTab.lines.length

  function updateTab(key: string, patch: Partial<PosTab>) {
    setTabs((prev) => prev.map((tab) => (tab.key === key ? { ...tab, ...patch } : tab)))
  }

  function handleOfferChange(offerId: string | null) {
    updateTab(activeTab.key, { offerId })
    if (isDraftSaved && activeTab.invoiceId) {
      updateInvoice.mutate({ id: activeTab.invoiceId, input: { offer_id: offerId } })
    }
  }

  function addTab() {
    const tab = newTab()
    setTabs((prev) => [...prev, tab])
    setActiveKey(tab.key)
  }

  function closeTab(key: string) {
    setTabs((prev) => {
      const remaining = prev.filter((tab) => tab.key !== key)
      const next = remaining.length ? remaining : [newTab()]
      if (key === activeKey) setActiveKey(next[0].key)
      return next
    })
  }

  function addItemToCart(item: Item, variant?: ItemVariant) {
    const variantId = variant?.id ?? null
    const unitPrice = variant ? variant.unit_price : item.unit_price
    const taxRate = taxRates?.find((r) => r.id === item.tax_rate_id)?.rate ?? 0

    if (!isDraftSaved) {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.key !== activeTab.key) return tab
          const existing = tab.lines.find((l) => l.itemId === item.id && l.itemVariantId === variantId)
          if (existing) {
            return {
              ...tab,
              lines: tab.lines.map((l) =>
                l.itemId === item.id && l.itemVariantId === variantId ? { ...l, quantity: l.quantity + 1 } : l,
              ),
            }
          }
          return {
            ...tab,
            lines: [
              ...tab.lines,
              {
                tempId: crypto.randomUUID(),
                itemId: item.id,
                itemVariantId: variantId,
                kind: "item",
                description: item.name,
                quantity: 1,
                unitPrice,
                taxRate,
              },
            ],
          }
        }),
      )
      return
    }

    // Already saved as a real draft invoice — edit it live, same as the
    // invoice detail page would.
    const existingLine = savedCartItems?.find(
      (line) => line.item_id === item.id && line.item_variant_id === variantId,
    )
    if (existingLine) {
      updateInvoiceItem.mutate({ id: existingLine.id, input: { quantity: existingLine.quantity + 1 } })
    } else {
      createInvoiceItem.mutate({
        invoice_id: activeTab.invoiceId!,
        item_id: item.id,
        item_variant_id: variantId,
        description: item.name,
        quantity: 1,
        unit_price: unitPrice,
        tax_rate: taxRate,
      })
    }
  }

  /** Adds a manual no-item line — a delivery fee/additional charge or a
   * discount — using the same nullable item_id mechanism purchase bills'
   * "Custom line" already relies on. No schema change: a discount is just
   * a negative unit_price, which recalc_invoice() already sums correctly. */
  function addCustomLine(kind: "charge" | "discount") {
    const description = kind === "discount" ? t("discountLineDefault") : t("chargeLineDefault")

    if (!isDraftSaved) {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.key !== activeTab.key
            ? tab
            : {
                ...tab,
                lines: [
                  ...tab.lines,
                  {
                    tempId: crypto.randomUUID(),
                    itemId: null,
                    itemVariantId: null,
                    kind,
                    description,
                    quantity: 1,
                    unitPrice: 0,
                    taxRate: 0,
                  },
                ],
              },
        ),
      )
      return
    }

    createInvoiceItem.mutate(
      {
        invoice_id: activeTab.invoiceId!,
        item_id: null,
        item_variant_id: null,
        description,
        quantity: 1,
        unit_price: 0,
        tax_rate: 0,
      },
      { onSuccess: (data) => setCustomLineKinds((prev) => ({ ...prev, [data.id]: kind })) },
    )
  }

  function changeLocalQuantity(tempId: string, quantity: number) {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.key !== activeTab.key) return tab
        if (quantity <= 0) {
          return { ...tab, lines: tab.lines.filter((l) => l.tempId !== tempId) }
        }
        return { ...tab, lines: tab.lines.map((l) => (l.tempId === tempId ? { ...l, quantity } : l)) }
      }),
    )
  }

  function changeSavedQuantity(lineId: string, quantity: number) {
    if (quantity <= 0) {
      deleteInvoiceItem.mutate(lineId)
    } else {
      updateInvoiceItem.mutate({ id: lineId, input: { quantity } })
    }
  }

  function changeLocalPrice(tempId: string, unitPrice: number) {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.key !== activeTab.key) return tab
        return { ...tab, lines: tab.lines.map((l) => (l.tempId === tempId ? { ...l, unitPrice } : l)) }
      }),
    )
  }

  function commitSavedPrice(lineId: string, unitPrice: number, previous: number) {
    // Negative is valid here — a discount custom line stores a negative
    // unit_price on purpose. The displayed magnitude is still clamped to
    // >= 0 by each price input's own min attribute.
    if (Number.isNaN(unitPrice) || unitPrice === previous) return
    updateInvoiceItem.mutate({ id: lineId, input: { unit_price: unitPrice } })
  }

  function changeLocalDescription(tempId: string, description: string) {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.key !== activeTab.key) return tab
        return { ...tab, lines: tab.lines.map((l) => (l.tempId === tempId ? { ...l, description } : l)) }
      }),
    )
  }

  function commitSavedDescription(lineId: string, description: string, previous: string, fallback: string) {
    const value = description.trim() || fallback
    if (value === previous) return
    updateInvoiceItem.mutate({ id: lineId, input: { description: value } })
  }

  function commitSavedNotes(value: string) {
    if (!activeTab.invoiceId || value === (activeInvoice?.notes ?? "")) return
    updateInvoice.mutate({ id: activeTab.invoiceId, input: { notes: value || null } })
  }

  async function clearCart() {
    if (isDraftSaved) {
      if (!savedCartItems?.length) return
      setIsClearing(true)
      try {
        await Promise.all(savedCartItems.map((line) => deleteInvoiceItem.mutateAsync(line.id)))
      } finally {
        setIsClearing(false)
      }
    } else {
      updateTab(activeTab.key, { lines: [] })
    }
  }

  async function resolveCustomerId(): Promise<string> {
    if (activeTab.customerId) return activeTab.customerId
    const existingGuest = customers?.find((c) => c.name === GUEST_CUSTOMER_NAME)
    if (existingGuest) return existingGuest.id
    const guest = await createCustomer.mutateAsync({ name: GUEST_CUSTOMER_NAME })
    return guest.id
  }

  /** Persists the local cart as a real draft invoice if it isn't one yet, and
   * returns its id either way. Both buttons below route through this — Save
   * as Draft to just pause here, Complete Sale to also confirm + collect
   * payment in the same click when nothing was saved yet. */
  async function ensureDraftSaved(): Promise<string> {
    if (activeTab.invoiceId) return activeTab.invoiceId
    const customerId = await resolveCustomerId()
    const invoice = await createInvoice.mutateAsync({
      customer_id: customerId,
      warehouse_id: activeTab.warehouseId,
      offer_id: activeTab.offerId || null,
      notes: activeTab.notes || null,
      issue_date: new Date().toISOString().slice(0, 10),
    })
    for (const line of activeTab.lines) {
      await createInvoiceItem.mutateAsync({
        invoice_id: invoice.id,
        item_id: line.itemId,
        item_variant_id: line.itemVariantId,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        tax_rate: line.taxRate,
      })
    }
    updateTab(activeTab.key, { invoiceId: invoice.id, customerId, offerId: activeTab.offerId, lines: [] })
    return invoice.id
  }

  /** Creates or updates the one billing.deliveries row for this invoice from
   * the tab's local delivery draft — a no-op unless "needs delivery" was
   * toggled on. Called after ensureDraftSaved() so invoiceId always exists. */
  async function persistDelivery(invoiceId: string) {
    if (!activeTab.delivery.enabled) return
    const payload = {
      delivery_address: activeTab.delivery.address ? { full_address: activeTab.delivery.address } : null,
      delivery_person_id: activeTab.delivery.deliveryPersonId,
      payment_mode: activeTab.delivery.paymentMode,
    }
    if (existingDelivery) {
      await updateDelivery.mutateAsync({ id: existingDelivery.id, input: payload })
    } else {
      await createDelivery.mutateAsync({ invoice_id: invoiceId, ...payload })
    }
  }

  async function saveAsDraft() {
    if (isDraftSaved || !activeTab.lines.length) return
    setIsSaving(true)
    try {
      const invoiceId = await ensureDraftSaved()
      await persistDelivery(invoiceId)
      toast.success(t("draftSaved"))
    } catch {
      toast.error(tCommon("genericError"))
    } finally {
      setIsSaving(false)
    }
  }

  /** Fetches the just-completed invoice fresh (rather than relying on
   * client cache, which may not have caught up with the status/payment
   * mutations yet) and sends it straight to the print dialog — no
   * intermediate "open the invoice, click Print" step after a sale. Runs
   * fire-and-forget: a failure here shouldn't undo or block the sale that
   * already succeeded. */
  async function printCompletedInvoice(invoiceId: string) {
    try {
      const [invoiceData, lineItems] = await Promise.all([
        fetchInvoiceById(invoiceId),
        fetchInvoiceItems(invoiceId),
      ])
      const element = await buildInvoicePdfElement({
        invoice: invoiceData,
        customer: customers?.find((c) => c.id === invoiceData.customer_id),
        organization: organizations?.[0],
        lineItems,
        items,
        tPrint,
      })
      await printInvoicePdf(element)
    } catch {
      // Printing is a bonus step after a sale that already succeeded —
      // don't surface an error toast for it.
    }
  }

  /** Confirms the invoice, then immediately records payment inline with
   * whatever method/amount chip is selected in the payment section — no
   * separate dialog step. Amount defaults to the invoice total unless the
   * cashier overrode it. */
  async function completeSale() {
    if (!isDraftSaved && !activeTab.lines.length) return
    setIsSaving(true)
    try {
      const invoiceId = await ensureDraftSaved()
      await persistDelivery(invoiceId)
      const paymentAmount = activeTab.paymentAmount ?? total
      const paymentMethod = activeTab.paymentMethod
      updateInvoice.mutate(
        { id: invoiceId, input: { status: "sent", warehouse_id: activeTab.warehouseId, offer_id: activeTab.offerId || null } },
        {
          onSuccess: () => {
            createPayment.mutate(
              {
                invoice_id: invoiceId,
                amount: paymentAmount,
                method: paymentMethod as Payment["method"],
                reference: null,
                notes: null,
                paid_at: new Date().toISOString().slice(0, 10),
              },
              {
                onSuccess: () => {
                  toast.success(t("saleCompleted"))
                  printCompletedInvoice(invoiceId)
                  closeTab(activeTab.key)
                },
                onError: () => toast.error(tCommon("genericError")),
              },
            )
          },
          onError: (error) => {
            const message = isAxiosError<{ error?: string }>(error) ? error.response?.data?.error : undefined
            toast.error(message ?? tCommon("genericError"))
          },
        },
      )
    } catch {
      toast.error(tCommon("genericError"))
    } finally {
      setIsSaving(false)
    }
  }

  const filteredItems = (items ?? []).filter(
    (item) => item.is_active && item.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const warehouseChosen = !!activeTab.warehouseId

  // One bulk request for every tracked item's variants at the chosen
  // warehouse, instead of one request per visible tile. Scoped to all
  // tracked items (not just the search-filtered subset) so typing in the
  // search box doesn't trigger a refetch on every keystroke.
  const trackedItemIds = (items ?? []).filter((item) => item.track_inventory).map((item) => item.id)
  const { data: allVariants } = useItemVariantsBulk(trackedItemIds, activeTab.warehouseId ?? undefined)
  const variantsByItemId = new Map<string, ItemVariant[]>()
  allVariants?.forEach((variant) => {
    const existing = variantsByItemId.get(variant.item_id)
    if (existing) existing.push(variant)
    else variantsByItemId.set(variant.item_id, [variant])
  })

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div
        ref={posContainerRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden bg-card",
          isFullscreen ? "rounded-none" : "rounded-xl ring-1 ring-foreground/10",
        )}
      >
        {/* Browser-style bill tabs */}
        <div className="flex items-end gap-1 overflow-x-auto border-b bg-muted/40 px-2 pt-2">
          {tabs.map((tab, index) => {
            const label = customers?.find((c) => c.id === tab.customerId)?.name || `${t("newTab")} ${index + 1}`
            const active = tab.key === activeKey
            return (
              <div
                key={tab.key}
                onClick={() => setActiveKey(tab.key)}
                className={cn(
                  "group flex h-9 max-w-45 shrink-0 cursor-pointer items-center gap-2 rounded-t-lg px-3 text-sm",
                  active ? "bg-card font-medium text-foreground shadow-[0_-1px_0_0_var(--border)_inset]" : "text-muted-foreground hover:bg-muted/70",
                )}
              >
                {tab.invoiceId ? <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" /> : null}
                <span className="truncate">{label}</span>
                <button
                  type="button"
                  title={t("closeTab")}
                  onClick={(event) => {
                    event.stopPropagation()
                    closeTab(tab.key)
                  }}
                  className="shrink-0 rounded p-0.5 opacity-0 hover:!opacity-100 group-hover:opacity-70 hover:bg-foreground/10"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            )
          })}
          <Button variant="ghost" size="icon-sm" onClick={addTab} className="mb-1 shrink-0">
            <PlusIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
            className="mb-1 ml-auto shrink-0"
          >
            {isFullscreen ? <Minimize2Icon /> : <Maximize2Icon />}
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,340px)_minmax(400px,1fr)_minmax(260px,320px)] divide-x divide-border overflow-x-auto overflow-y-hidden">
          {/* Column 1 — warehouse, search + item grid */}
          <div className="flex min-h-0 min-w-0 flex-col p-4">
            <Select
              value={activeTab.warehouseId ?? undefined}
              onValueChange={(value) => updateTab(activeTab.key, { warehouseId: value })}
              disabled={isDraftSaved || activeTab.lines.length > 0}
            >
              <SelectTrigger className="mb-3 w-full">
                <SelectValue placeholder={t("warehousePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {warehouses?.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {warehouseChosen ? (
              <>
                <div className="relative mb-3">
                  <SearchIcon className="pointer-events-none absolute top-1/2 start-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("searchPlaceholder")}
                    className="ps-8"
                  />
                </div>
                <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2.5 overflow-y-auto pr-1">
                  {filteredItems.length ? (
                    filteredItems.map((item) => (
                      <ItemTile key={item.id} item={item} variants={variantsByItemId.get(item.id)} onAdd={addItemToCart} />
                    ))
                  ) : (
                    <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">{t("noItems")}</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-muted/30 p-8 text-center">
                <p className="text-sm text-muted-foreground">{t("selectWarehouseFirst")}</p>
              </div>
            )}
          </div>

          {/* Column 2 — cart lines, offer, note */}
          <div className="flex min-h-0 min-w-0 flex-col p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {t("cartTitle")} <span className="font-normal text-muted-foreground">{t("cartCount", { count: cartCount })}</span>
              </h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => addCustomLine("charge")}>
                  {t("addChargeLine")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addCustomLine("discount")}>
                  {t("addDiscountLine")}
                </Button>
                <Button variant="ghost" size="sm" onClick={clearCart} disabled={!cartCount || isClearing}>
                  {t("clearCart")}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isDraftSaved ? (
                savedCartItems?.length ? (
                  <div className="flex flex-col">
                    {savedCartItems.map((line) => {
                      const kind: CartLine["kind"] = line.item_id
                        ? "item"
                        : line.unit_price !== 0
                          ? line.unit_price < 0
                            ? "discount"
                            : "charge"
                          : (customLineKinds[line.id] ?? "charge")
                      const fallbackName = kind === "discount" ? t("discountLineDefault") : t("chargeLineDefault")
                      const displayPrice = kind === "discount" ? Math.abs(line.unit_price) : line.unit_price
                      const lineTotal = line.quantity * line.unit_price
                      return (
                        <div key={line.id} className="flex items-center gap-2 border-b border-border/70 py-2.5 last:border-0">
                          <div className="min-w-0 flex-1">
                            {kind === "item" ? (
                              <p className="truncate text-sm font-medium">{line.description}</p>
                            ) : (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  defaultValue={line.description}
                                  onBlur={(event) =>
                                    commitSavedDescription(line.id, event.target.value, line.description, fallbackName)
                                  }
                                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium focus:outline-none"
                                />
                                <span className="shrink-0 rounded bg-muted px-1 py-0.2 text-[10px] font-normal uppercase text-muted-foreground">
                                  {fallbackName}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>₹</span>
                              <input
                                type="number"
                                step="any"
                                min={0}
                                defaultValue={displayPrice}
                                onBlur={(event) => {
                                  const magnitude = event.target.valueAsNumber
                                  const signed = kind === "discount" ? -Math.abs(magnitude) : magnitude
                                  commitSavedPrice(line.id, signed, line.unit_price)
                                }}
                                className="w-14 border-0 bg-transparent p-0 text-xs text-muted-foreground focus:text-foreground focus:outline-none"
                              />
                              <span>× {line.quantity}</span>
                            </div>
                          </div>
                          <QtyStepper
                            value={line.quantity}
                            onDecrement={() => changeSavedQuantity(line.id, line.quantity - 1)}
                            onIncrement={() => changeSavedQuantity(line.id, line.quantity + 1)}
                          />
                          <span
                            className={cn(
                              "w-20 shrink-0 text-right text-sm font-semibold tabular-nums",
                              kind === "discount" && "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {kind === "discount" ? "−" : ""}
                            {money(Math.abs(lineTotal))}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => deleteInvoiceItem.mutate(line.id)}
                          >
                            <TrashIcon />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t("emptyCart")}</p>
                )
              ) : activeTab.lines.length ? (
                <div className="flex flex-col">
                  {activeTab.lines.map((line) => {
                    const fallbackName = line.kind === "discount" ? t("discountLineDefault") : t("chargeLineDefault")
                    const displayPrice = line.kind === "discount" ? Math.abs(line.unitPrice) : line.unitPrice
                    const lineTotal = line.quantity * line.unitPrice
                    return (
                      <div key={line.tempId} className="flex items-center gap-2 border-b border-border/70 py-2.5 last:border-0">
                        <div className="min-w-0 flex-1">
                          {line.kind === "item" ? (
                            <p className="truncate text-sm font-medium">{line.description}</p>
                          ) : (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={line.description}
                                onChange={(event) => changeLocalDescription(line.tempId, event.target.value)}
                                onBlur={(event) => {
                                  if (!event.target.value.trim()) changeLocalDescription(line.tempId, fallbackName)
                                }}
                                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium focus:outline-none"
                              />
                              <span className="shrink-0 rounded bg-muted px-1 py-0.2 text-[10px] font-normal uppercase text-muted-foreground">
                                {fallbackName}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>₹</span>
                            <input
                              type="number"
                              step="any"
                              min={0}
                              value={displayPrice}
                              onChange={(event) => {
                                const magnitude = event.target.valueAsNumber
                                const value = Number.isNaN(magnitude) ? 0 : magnitude
                                changeLocalPrice(line.tempId, line.kind === "discount" ? -Math.abs(value) : value)
                              }}
                              className="w-14 border-0 bg-transparent p-0 text-xs text-muted-foreground focus:text-foreground focus:outline-none"
                            />
                            <span>× {line.quantity}</span>
                          </div>
                        </div>
                        <QtyStepper
                          value={line.quantity}
                          onDecrement={() => changeLocalQuantity(line.tempId, line.quantity - 1)}
                          onIncrement={() => changeLocalQuantity(line.tempId, line.quantity + 1)}
                        />
                        <span
                          className={cn(
                            "w-20 shrink-0 text-right text-sm font-semibold tabular-nums",
                            line.kind === "discount" && "text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {line.kind === "discount" ? "−" : ""}
                          {money(Math.abs(lineTotal))}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => changeLocalQuantity(line.tempId, 0)}
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("emptyCart")}</p>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t pt-3">
              <OfferSelect
                offers={offers}
                value={selectedOfferId}
                onValueChange={handleOfferChange}
                placeholder={t("offerPlaceholder")}
              />
              <Textarea
                placeholder={t("notePlaceholder")}
                className="min-h-13 resize-none text-sm"
                value={isDraftSaved ? undefined : activeTab.notes}
                defaultValue={isDraftSaved ? (activeInvoice?.notes ?? "") : undefined}
                onChange={isDraftSaved ? undefined : (event) => updateTab(activeTab.key, { notes: event.target.value })}
                onBlur={isDraftSaved ? (event) => commitSavedNotes(event.target.value) : undefined}
              />
            </div>
          </div>

          {/* Column 3 — payment section: customer, delivery, totals, payment method, actions */}
          <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto p-4">
            <CustomerSelect
              customers={customers}
              value={activeTab.customerId}
              onValueChange={(value) => updateTab(activeTab.key, { customerId: value })}
              disabled={isDraftSaved}
              placeholder={t("customerPlaceholder")}
              className="w-full"
              onAddNew={isDraftSaved ? undefined : () => setShowAddCustomer(true)}
              addNewLabel={t("addCustomer")}
            />

            <div className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <TruckIcon className="size-3.5 text-muted-foreground" />
                  {t("deliverySectionTitle")}
                </span>
                <Switch
                  checked={activeTab.delivery.enabled}
                  onCheckedChange={(checked) =>
                    updateTab(activeTab.key, { delivery: { ...activeTab.delivery, enabled: checked } })
                  }
                />
              </div>
              {activeTab.delivery.enabled ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    placeholder={t("deliveryAddressPlaceholder")}
                    className="min-h-10 resize-none text-sm"
                    value={activeTab.delivery.address}
                    onChange={(event) =>
                      updateTab(activeTab.key, { delivery: { ...activeTab.delivery, address: event.target.value } })
                    }
                  />
                  <Select
                    value={activeTab.delivery.deliveryPersonId ?? undefined}
                    onValueChange={(value) =>
                      updateTab(activeTab.key, { delivery: { ...activeTab.delivery, deliveryPersonId: value } })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("deliveryPersonPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryPersons
                        ?.filter((person) => person.is_active)
                        .map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={activeTab.delivery.paymentMode ?? undefined}
                    onValueChange={(value) =>
                      updateTab(activeTab.key, {
                        delivery: { ...activeTab.delivery, paymentMode: value as "cod" | "prepaid" },
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("deliveryPaymentModeLabel")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cod">{tDeliveryPaymentMode("cod")}</SelectItem>
                      <SelectItem value="prepaid">{tDeliveryPaymentMode("prepaid")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotalLabel")}</span>
                <span className="tabular-nums">{money(subtotal)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <span>{t("discountLabel")}</span>
                    {selectedOffer && (
                      <span className="rounded bg-emerald-100 px-1 py-0.2 text-[10px] dark:bg-emerald-950/60">
                        {selectedOffer.name}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">−{money(discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("taxLabel")}</span>
                <span className="tabular-nums">{money(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>{t("totalLabel")}</span>
                <span className="tabular-nums">{money(total)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">{tPay("methodLabel")}</span>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = PAYMENT_METHOD_ICONS[method]
                  const selected = activeTab.paymentMethod === method
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => updateTab(activeTab.key, { paymentMethod: method })}
                      className={cn(
                        "flex h-10 items-center justify-center gap-2 rounded-lg border text-xs font-medium transition-colors",
                        selected
                          ? "border-foreground bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <Icon className="size-3.5" />
                      <span>{method === "razorpay" ? t("paymentCard") : tMethods(method)}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{tPay("amountLabel")}</label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={activeTab.paymentAmount ?? total}
                onChange={(event) => {
                  const value = event.target.valueAsNumber
                  updateTab(activeTab.key, { paymentAmount: Number.isNaN(value) ? 0 : value })
                }}
                className="font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="lg"
                disabled={isDraftSaved || !activeTab.lines.length || isSaving}
                onClick={saveAsDraft}
              >
                {t("saveAsDraft")}
              </Button>
              <Button
                size="lg"
                disabled={(!isDraftSaved && !activeTab.lines.length) || (isDraftSaved && !savedCartItems?.length) || isSaving}
                onClick={completeSale}
              >
                {t("completeSale")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <QuickAddCustomerDialog
        open={showAddCustomer}
        onOpenChange={setShowAddCustomer}
        onCreated={(customerId) => updateTab(activeTab.key, { customerId })}
      />
    </div>
  )
}
