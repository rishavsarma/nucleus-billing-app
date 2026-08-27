"use client"

import { useEffect, useRef, useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  BanknoteIcon,
  CalendarClockIcon,
  CreditCardIcon,
  LandmarkIcon,
  Loader2Icon,
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

import { useRouter } from "@/i18n/navigation"
import { routes } from "@/lib/routes"
import { Button } from "@/components/ui/button"
import { CustomerSelect } from "@/components/customer-select"
import { DatePicker } from "@/components/ui/date-picker"
import { Field, FieldLabel } from "@/components/ui/field"
import { OfferSelect } from "@/components/offer-select"
import { Input } from "@/components/ui/input"
import { QuickAddCustomerDialog } from "@/components/quick-add-customer-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { calculateOfferDiscount } from "@/lib/calculate-offer"
import { cn } from "@/lib/utils"
import { useCreateCustomer } from "@/hooks/use-customers"
import { fetchCustomerById, fetchCustomersPaginated } from "@/lib/database/services/customers"
import { useCreateDelivery, useDeliveryByInvoice, useUpdateDelivery } from "@/hooks/use-deliveries"
import { StaffSelect } from "@/components/staff-select"
import { fetchInvoiceItems } from "@/lib/database/services/invoice-items"
import { fetchInvoiceById } from "@/lib/database/services/invoices"
import { fetchItemById, fetchItemsPaginated } from "@/lib/database/services/items"
import { useCreateInstallment } from "@/hooks/use-installments"
import { useCreateInstallmentPlan } from "@/hooks/use-installment-plans"
import { useCreateInvoiceItem, useDeleteInvoiceItem, useInvoiceItems, useUpdateInvoiceItem } from "@/hooks/use-invoice-items"
import { useCreateInvoice, useInvoice, useUpdateInvoice } from "@/hooks/use-invoices"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useItemVariantsBulk } from "@/hooks/use-item-variants"
import { useOffer } from "@/hooks/use-offers"
import { useCurrentOrganization } from "@/hooks/use-organizations"
import { useActivePdfWatermarkText } from "@/hooks/use-pdf-watermarks"
import { useCreatePayment } from "@/hooks/use-payments"
import { useTaxRates } from "@/hooks/use-tax-rates"
import { WarehouseSelect } from "@/components/warehouse-select"
import { buildInvoicePdfElement, downloadInvoicePdf } from "@/lib/pdf/invoice-pdf"
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
  // When true, Complete Sale confirms the invoice without recording a
  // payment, sets up the installment plan itself using emiMonths/
  // emiStartDate below, and only then hands off to the invoice detail page
  // — keeps EMI billing from ever double-counting against the full-amount
  // payment Complete Sale would otherwise record immediately.
  isEmi: boolean
  emiMonths: number
  emiStartDate: string
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
    isEmi: false,
    emiMonths: 3,
    emiStartDate: new Date().toISOString().slice(0, 10),
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
  const tEmi = useTranslations("Emi")
  const router = useRouter()

  const { data: taxRates } = useTaxRates()
  const { data: organization } = useCurrentOrganization()
  const watermarkText = useActivePdfWatermarkText()
  const createInvoice = useCreateInvoice()
  const createInvoiceItem = useCreateInvoiceItem()
  const updateInvoiceItem = useUpdateInvoiceItem(undefined)
  const deleteInvoiceItem = useDeleteInvoiceItem(undefined)
  const updateInvoice = useUpdateInvoice()
  const createPayment = useCreatePayment()
  const createInstallmentPlan = useCreateInstallmentPlan()
  const createInstallment = useCreateInstallment()
  const createCustomer = useCreateCustomer()
  const createDelivery = useCreateDelivery()
  const updateDelivery = useUpdateDelivery()

  const [tabs, setTabs] = useState<PosTab[]>([newTab()])
  const [activeKey, setActiveKey] = useState(tabs[0].key)
  const [search, setSearch] = useState("")
  // The item grid searches the server as you type and loads further pages
  // on scroll, instead of fetching the entire catalog up front and
  // filtering it in the browser — that both silently dropped anything past
  // the old pageSize:9999 cap and shipped every item on every POS load
  // regardless of catalog size.
  const debouncedItemSearch = useDebouncedValue(search, 300)
  const [itemsPage, setItemsPage] = useState(1)
  // Resets the loaded page count back to 1 the moment the (debounced)
  // search term changes — the "adjust state during render" pattern
  // (react.dev/learn/you-might-not-need-an-effect) rather than an effect,
  // since this needs to happen before the extra pages' queries below fire
  // for a search term they no longer match.
  const [itemSearchForPage, setItemSearchForPage] = useState(debouncedItemSearch)
  if (debouncedItemSearch !== itemSearchForPage) {
    setItemSearchForPage(debouncedItemSearch)
    setItemsPage(1)
  }
  // One query per loaded page (1..itemsPage), each cached under the same
  // queryKey shape useItemsList uses — scrolling back up never re-fetches
  // a page already seen, and every page is capped at 60 rows instead of
  // the old pageSize:9999 "fetch the whole catalog" approach.
  const itemPageQueries = useQueries({
    queries: Array.from({ length: itemsPage }, (_, index) => {
      const page = index + 1
      const params = { search: debouncedItemSearch, page, pageSize: 60 }
      return { queryKey: ["items", "list", params], queryFn: () => fetchItemsPaginated(params) }
    }),
  })
  const loadedItems = itemPageQueries.flatMap((query) => query.data?.data ?? [])
  const lastLoadedItemsPage = itemPageQueries[itemPageQueries.length - 1]?.data
  const hasMoreItems = lastLoadedItemsPage ? loadedItems.length < lastLoadedItemsPage.total : false
  const isFetchingItems = itemPageQueries.some((query) => query.isFetching)
  const loadMoreItemsRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = loadMoreItemsRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreItems && !isFetchingItems) {
          setItemsPage((page) => page + 1)
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMoreItems, isFetchingItems])

  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  // A CSS-only "focus mode" (fixed, covers the viewport) rather than the
  // native Fullscreen API — deliberate, not an oversight. Real Fullscreen
  // gets force-exited by *any* native browser/OS dialog (print, file save,
  // a future card-reader or signature-pad popup), which kept minimizing
  // the POS after Complete Sale. A CSS overlay has nothing for those
  // dialogs to exit, since it was never real Fullscreen to begin with; the
  // trade-off is the browser's own tab/URL bar stay visible.
  const [isFocusMode, setIsFocusMode] = useState(true)
  const posContainerRef = useRef<HTMLDivElement>(null)
  // Dropdowns/dialogs portal into this element instead of document.body
  // (see the `container` props below). Kept even though it's no longer
  // strictly required now that focus mode isn't real Fullscreen — still
  // correct, and there's no reason to re-plumb six call sites to remove it.
  // Mirrored into state via the callback ref below rather than read from
  // posContainerRef.current directly in JSX, since reading a ref's .current
  // during render is unsafe/disallowed by the rules of React.
  const [posContainerEl, setPosContainerEl] = useState<HTMLDivElement | null>(null)
  // A saved custom line's only persisted signal for "charge vs discount" is
  // the sign of its unit_price — but it starts at 0 (ambiguous) until the
  // cashier types an amount, and by then the description may have been
  // renamed away from the "Additional Charge"/"Discount" default. This map
  // bridges that gap: recorded once at creation, read only while the price
  // is still exactly 0.
  const [customLineKinds, setCustomLineKinds] = useState<Record<string, "charge" | "discount">>({})

  // Native Fullscreen exits on Escape automatically; a CSS overlay doesn't,
  // so this replicates that one bit of expected behavior.
  useEffect(() => {
    if (!isFocusMode) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsFocusMode(false)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isFocusMode])

  function toggleFocusMode() {
    setIsFocusMode((prev) => !prev)
  }

  // Falls back to the first tab instead of crashing if activeKey ever
  // desyncs from tabs (defense in depth — closeTab is the only place that
  // removes tabs, and it's written to keep both in sync, but this keeps a
  // future regression of that class from taking the whole page down).
  const activeTab = tabs.find((tab) => tab.key === activeKey) ?? tabs[0]
  const { data: activeInvoice } = useInvoice(activeTab.invoiceId ?? undefined)

  // Resolves each open tab's customer name for its tab label — a handful
  // of single-row lookups scoped to whatever's actually open right now,
  // not the whole customer table (queryKey matches useCustomer's own, so
  // this shares cache with it rather than double-fetching).
  const tabCustomerIds = [...new Set(tabs.map((tab) => tab.customerId).filter((id): id is string => !!id))]
  const tabCustomerQueries = useQueries({
    queries: tabCustomerIds.map((customerId) => ({
      queryKey: ["customers", "detail", customerId],
      queryFn: () => fetchCustomerById(customerId),
    })),
  })
  const tabCustomerNameById = new Map(
    tabCustomerIds.map((customerId, index) => [customerId, tabCustomerQueries[index]?.data?.name]),
  )

  const { data: savedCartItems } = useInvoiceItems(activeTab.invoiceId ?? undefined)
  const { data: existingDelivery } = useDeliveryByInvoice(activeTab.invoiceId ?? undefined)
  const isDraftSaved = !!activeTab.invoiceId

  const selectedOfferId = isDraftSaved ? (activeInvoice?.offer_id ?? null) : activeTab.offerId
  const { data: selectedOffer } = useOffer(selectedOfferId ?? undefined)

  const localTotals = lineTotals(activeTab.lines)
  const blendedSubtotal = isDraftSaved ? (activeInvoice?.subtotal ?? 0) : localTotals.subtotal
  const tax = isDraftSaved ? (activeInvoice?.tax_total ?? 0) : localTotals.tax
  const discount = isDraftSaved
    ? (activeInvoice?.discount_total ?? 0)
    : calculateOfferDiscount(selectedOffer, blendedSubtotal, tax)
  const total = isDraftSaved
    ? (activeInvoice?.total ?? 0)
    : Math.max(0, blendedSubtotal + tax - discount)

  // Fees/discounts aren't items — the cart list below only ever shows
  // kind === "item" rows; every charge/discount line renders as its own
  // editable row in the totals panel instead, via *ChargeDiscountLines.
  // "Subtotal" in that panel is the items-only sum, not blendedSubtotal
  // (which still folds charges/discounts in — that's what makes `total`
  // above correct without touching its formula).
  const savedItemLines = (savedCartItems ?? []).filter((l) => l.item_id)
  const savedChargeDiscountLines = (savedCartItems ?? []).filter((l) => !l.item_id)
  const localItemLines = activeTab.lines.filter((l) => l.kind === "item")
  const localChargeDiscountLines = activeTab.lines.filter((l) => l.kind !== "item")
  const subtotal = isDraftSaved
    ? savedItemLines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
    : localItemLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  const cartCount = isDraftSaved ? savedItemLines.length : localItemLines.length

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
    // Both branches use the functional setState form (never the `activeKey`
    // closure directly) so this stays correct even when two closeTab calls
    // land in the same batch before a re-render — e.g. closing two tabs in
    // quick succession. Comparing against the closure's `activeKey` here
    // used to go stale in exactly that case, leaving activeKey pointing at
    // a tab that had already been removed by the other call, which crashed
    // `tabs.find(...)!` downstream.
    let nextActiveKey = key
    setTabs((prev) => {
      const remaining = prev.filter((tab) => tab.key !== key)
      const next = remaining.length ? remaining : [newTab()]
      nextActiveKey = next[0].key
      return next
    })
    setActiveKey((prevActiveKey) => (prevActiveKey === key ? nextActiveKey : prevActiveKey))
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

  /** Adds a manual no-item line — an additional charge, a delivery fee, or a
   * discount — using the same nullable item_id mechanism purchase bills'
   * "Custom line" already relies on. No schema change: a discount is just
   * a negative unit_price, which recalc_invoice() already sums correctly.
   * `description` lets a caller pre-fill the label (e.g. "Delivery Fee")
   * instead of the generic per-kind default. */
  function addCustomLine(kind: "charge" | "discount", descriptionOverride?: string) {
    const description = descriptionOverride ?? (kind === "discount" ? t("discountLineDefault") : t("chargeLineDefault"))

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

  /** The Delivery Fee field in the Delivery card drives one specific cart
   * line (kind "charge", a fixed description) instead of the cashier having
   * to use "+ Charge" and rename it — same no-item-id mechanism as
   * addCustomLine, just a dedicated field for a fee common enough to
   * deserve one. Matched by description since invoice_items has no column
   * to mark "this charge is the delivery fee." */
  function deliveryFeeValue(): number {
    const label = t("deliveryFeeLineDefault")
    if (!isDraftSaved) {
      return activeTab.lines.find((l) => l.kind === "charge" && l.description === label)?.unitPrice ?? 0
    }
    return savedCartItems?.find((l) => !l.item_id && l.description === label)?.unit_price ?? 0
  }

  function setDeliveryFee(rawValue: number) {
    const label = t("deliveryFeeLineDefault")
    const amount = Number.isNaN(rawValue) ? 0 : Math.max(0, rawValue)

    if (!isDraftSaved) {
      const existing = activeTab.lines.find((l) => l.kind === "charge" && l.description === label)
      if (amount <= 0) {
        if (existing) changeLocalQuantity(existing.tempId, 0)
        return
      }
      if (existing) {
        changeLocalPrice(existing.tempId, amount)
      } else {
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
                      kind: "charge",
                      description: label,
                      quantity: 1,
                      unitPrice: amount,
                      taxRate: 0,
                    },
                  ],
                },
          ),
        )
      }
      return
    }

    const existing = savedCartItems?.find((l) => !l.item_id && l.description === label)
    if (amount <= 0) {
      if (existing) deleteInvoiceItem.mutate(existing.id)
      return
    }
    if (existing) {
      updateInvoiceItem.mutate({ id: existing.id, input: { unit_price: amount } })
    } else {
      createInvoiceItem.mutate(
        {
          invoice_id: activeTab.invoiceId!,
          item_id: null,
          item_variant_id: null,
          description: label,
          quantity: 1,
          unit_price: amount,
          tax_rate: 0,
        },
        { onSuccess: (data) => setCustomLineKinds((prev) => ({ ...prev, [data.id]: "charge" })) },
      )
    }
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
    // Search-scoped instead of pulling every customer to find this one by
    // exact name — the search itself is a substring match, so still
    // confirm an exact match among the (small) results before reusing it.
    const { data: matches } = await fetchCustomersPaginated({ search: GUEST_CUSTOMER_NAME, pageSize: 10 })
    const existingGuest = matches.find((c) => c.name === GUEST_CUSTOMER_NAME)
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
   * mutations yet) and downloads it as a PDF. Deliberately NOT called
   * automatically after Complete Sale — a file download still triggers the
   * browser's own save prompt, which is a native dialog just like the
   * print dialog it replaced, and forcing that on every single sale is
   * exactly the interruption this was meant to avoid. Wired instead as the
   * action button on the "Sale completed" toast, so the download only
   * happens on a deliberate click. */
  async function printCompletedInvoice(invoiceId: string) {
    try {
      const [invoiceData, lineItems] = await Promise.all([
        fetchInvoiceById(invoiceId),
        fetchInvoiceItems(invoiceId),
      ])
      // Only the specific items this sale's lines reference — not the
      // whole catalog — resolved for the PDF's item name/details.
      const referencedItemIds = [...new Set(lineItems.map((line) => line.item_id).filter((id): id is string => !!id))]
      const [customer, referencedItems] = await Promise.all([
        fetchCustomerById(invoiceData.customer_id),
        Promise.all(referencedItemIds.map((itemId) => fetchItemById(itemId))),
      ])
      const element = await buildInvoicePdfElement({
        invoice: invoiceData,
        customer,
        organization,
        lineItems,
        items: referencedItems,
        tPrint,
        watermarkText,
      })
      await downloadInvoicePdf(element, `${invoiceData.invoice_number ?? "invoice"}.pdf`)
    } catch {
      // Downloading is a bonus step after a sale that already succeeded —
      // don't surface an error toast for it.
    }
  }

  /** Creates the installment plan and its full schedule of installment rows
   * for a just-confirmed EMI sale — same math as the invoice detail page's
   * "Set up EMI" dialog (components/setup-emi-dialog.tsx), just invoked
   * directly from the POS instead of via a separate follow-up step. */
  async function setupEmiPlan(invoiceId: string, invoiceTotal: number, months: number, startDate: string) {
    const plan = await createInstallmentPlan.mutateAsync({
      invoice_id: invoiceId,
      total_amount: invoiceTotal,
      months,
      start_date: startDate,
    })
    const base = Math.floor((invoiceTotal / months) * 100) / 100
    let allocated = 0
    const start = new Date(startDate)
    for (let i = 0; i < months; i++) {
      const isLast = i === months - 1
      const amount = isLast ? Math.round((invoiceTotal - allocated) * 100) / 100 : base
      allocated += amount
      const dueDate = new Date(start)
      dueDate.setMonth(dueDate.getMonth() + i)
      await createInstallment.mutateAsync({
        plan_id: plan.id,
        invoice_id: invoiceId,
        installment_number: i + 1,
        due_date: dueDate.toISOString().slice(0, 10),
        amount,
      })
    }
  }

  /** Confirms the invoice, then immediately records payment inline with
   * whatever method/amount chip is selected in the payment section — no
   * separate dialog step. Amount defaults to the invoice total unless the
   * cashier overrode it.
   *
   * When "Sell as EMI" is on, no payment is recorded here at all — the
   * invoice is just confirmed and the installment plan is set up right
   * here using the months/start date chosen in the EMI section, then the
   * cashier is sent to the invoice detail page to see the schedule.
   * Recording a full payment now and then setting up EMI afterward is
   * exactly what caused amount_paid to double-count (full payment + first
   * installment), so this path deliberately skips createPayment rather
   * than trying to record a partial/zero payment. */
  async function completeSale() {
    if (!isDraftSaved && !activeTab.lines.length) return
    setIsSaving(true)
    try {
      const invoiceId = await ensureDraftSaved()
      await persistDelivery(invoiceId)
      const isEmi = activeTab.isEmi
      const emiMonths = activeTab.emiMonths
      const emiStartDate = activeTab.emiStartDate
      const invoiceTotal = total
      const paymentAmount = activeTab.paymentAmount ?? total
      const paymentMethod = activeTab.paymentMethod
      updateInvoice.mutate(
        { id: invoiceId, input: { status: "sent", warehouse_id: activeTab.warehouseId, offer_id: activeTab.offerId || null } },
        {
          onSuccess: () => {
            if (isEmi) {
              setupEmiPlan(invoiceId, invoiceTotal, emiMonths, emiStartDate)
                .then(() => {
                  toast.success(t("saleCompletedEmi"), {
                    duration: 8000,
                    action: { label: t("downloadInvoiceAction"), onClick: () => printCompletedInvoice(invoiceId) },
                  })
                  closeTab(activeTab.key)
                  router.push(routes.sales.invoices.detail(invoiceId))
                })
                .catch(() => toast.error(tCommon("genericError")))
              return
            }
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
                  toast.success(t("saleCompleted"), {
                    duration: 8000,
                    action: { label: t("downloadInvoiceAction"), onClick: () => printCompletedInvoice(invoiceId) },
                  })
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

  // Name/SKU matching already happened server-side (debouncedItemSearch is
  // passed to useItemsList above) — this just drops inactive items from
  // whatever page(s) are already loaded.
  const filteredItems = loadedItems.filter((item) => item.is_active)

  const warehouseChosen = !!activeTab.warehouseId

  // One bulk request for every tracked item's variants among the
  // currently-loaded page(s), instead of one request per visible tile (and
  // instead of every tracked item in the whole catalog, now that the grid
  // itself is paginated).
  const trackedItemIds = loadedItems.filter((item) => item.track_inventory).map((item) => item.id)
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
        ref={(node) => {
          posContainerRef.current = node
          setPosContainerEl(node)
        }}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden bg-card",
          // z-[110]: the app sidebar's own fixed panel renders at z-100
          // (components/ui/sidebar.tsx), so this has to clear that to
          // actually cover it — z-40 quietly rendered underneath it.
          isFocusMode
            ? "fixed inset-0 z-[110] rounded-none"
            : "rounded-xl ring-1 ring-foreground/10",
        )}
      >
        {/* Browser-style bill tabs */}
        <div className="flex items-end gap-1 overflow-x-auto border-b bg-muted/40 px-2 pt-2">
          {tabs.map((tab, index) => {
            const label = (tab.customerId && tabCustomerNameById.get(tab.customerId)) || `${t("newTab")} ${index + 1}`
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
            onClick={toggleFocusMode}
            title={isFocusMode ? t("exitFullscreen") : t("fullscreen")}
            className="mb-1 ml-auto shrink-0"
          >
            {isFocusMode ? <Minimize2Icon /> : <Maximize2Icon />}
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,340px)_minmax(400px,1fr)_minmax(260px,320px)] divide-x divide-border overflow-x-auto overflow-y-hidden">
          {/* Column 1 — warehouse, search + item grid */}
          <div className="flex min-h-0 min-w-0 flex-col p-4">
            <WarehouseSelect
              value={activeTab.warehouseId}
              onValueChange={(value) => updateTab(activeTab.key, { warehouseId: value })}
              disabled={isDraftSaved || activeTab.lines.length > 0}
              placeholder={t("warehousePlaceholder")}
              className="mb-3"
              container={posContainerEl}
            />
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
                    <>
                      {filteredItems.map((item) => (
                        <ItemTile key={item.id} item={item} variants={variantsByItemId.get(item.id)} onAdd={addItemToCart} />
                      ))}
                      {hasMoreItems ? (
                        <div ref={loadMoreItemsRef} className="col-span-2 flex justify-center py-3">
                          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : null}
                    </>
                  ) : isFetchingItems ? (
                    <div className="col-span-2 flex justify-center py-8">
                      <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                    </div>
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

          {/* Column 2 — cart lines (items only — fees/discounts live in the totals panel), offer, note */}
          <div className="flex min-h-0 min-w-0 flex-col p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {t("cartTitle")} <span className="font-normal text-muted-foreground">{t("cartCount", { count: cartCount })}</span>
              </h2>
              <Button variant="ghost" size="sm" onClick={clearCart} disabled={!cartCount || isClearing}>
                {t("clearCart")}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isDraftSaved ? (
                savedItemLines.length ? (
                  <div className="flex flex-col">
                    {savedItemLines.map((line) => {
                      const lineTotal = line.quantity * line.unit_price
                      return (
                        <div key={line.id} className="flex items-center gap-2 border-b border-border/70 py-2.5 last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{line.description}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>₹</span>
                              <input
                                type="number"
                                step="any"
                                min={0}
                                defaultValue={line.unit_price}
                                onBlur={(event) => commitSavedPrice(line.id, event.target.valueAsNumber, line.unit_price)}
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
                          <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">{money(lineTotal)}</span>
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
              ) : localItemLines.length ? (
                <div className="flex flex-col">
                  {localItemLines.map((line) => {
                    const lineTotal = line.quantity * line.unitPrice
                    return (
                      <div key={line.tempId} className="flex items-center gap-2 border-b border-border/70 py-2.5 last:border-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{line.description}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>₹</span>
                            <input
                              type="number"
                              step="any"
                              min={0}
                              value={line.unitPrice}
                              onChange={(event) => {
                                const value = event.target.valueAsNumber
                                changeLocalPrice(line.tempId, Number.isNaN(value) ? 0 : value)
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
                        <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">{money(lineTotal)}</span>
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
                value={selectedOfferId}
                onValueChange={handleOfferChange}
                placeholder={t("offerPlaceholder")}
                container={posContainerEl}
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
              value={activeTab.customerId}
              onValueChange={(value) => updateTab(activeTab.key, { customerId: value })}
              disabled={isDraftSaved}
              placeholder={t("customerPlaceholder")}
              className="w-full"
              onAddNew={isDraftSaved ? undefined : () => setShowAddCustomer(true)}
              addNewLabel={t("addCustomer")}
              container={posContainerEl}
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
                  <StaffSelect
                    role="delivery_person"
                    value={activeTab.delivery.deliveryPersonId}
                    onValueChange={(value) =>
                      updateTab(activeTab.key, { delivery: { ...activeTab.delivery, deliveryPersonId: value } })
                    }
                    placeholder={t("deliveryPersonPlaceholder")}
                    container={posContainerEl}
                  />
                  <Input
                    key={activeTab.invoiceId ?? activeTab.key}
                    type="number"
                    step="any"
                    min={0}
                    placeholder={t("deliveryFeeLineDefault")}
                    defaultValue={deliveryFeeValue() || ""}
                    onChange={
                      isDraftSaved ? undefined : (event) => setDeliveryFee(event.target.valueAsNumber)
                    }
                    onBlur={
                      isDraftSaved ? (event) => setDeliveryFee(event.target.valueAsNumber) : undefined
                    }
                  />
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
                    <SelectContent container={posContainerEl}>
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

              {/* Fees/discounts — not items, so they live here instead of the cart list. */}
              {isDraftSaved
                ? savedChargeDiscountLines.map((line) => {
                    const kind: "charge" | "discount" =
                      line.unit_price < 0 ? "discount" : line.unit_price > 0 ? "charge" : (customLineKinds[line.id] ?? "charge")
                    const fallbackName = kind === "discount" ? t("discountLineDefault") : t("chargeLineDefault")
                    const displayPrice = Math.abs(line.unit_price)
                    return (
                      <div key={line.id} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          defaultValue={line.description}
                          onBlur={(event) => commitSavedDescription(line.id, event.target.value, line.description, fallbackName)}
                          className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-muted-foreground focus:text-foreground focus:outline-none"
                        />
                        <span>₹</span>
                        <input
                          type="number"
                          step="any"
                          min={0}
                          defaultValue={displayPrice}
                          onBlur={(event) => {
                            const magnitude = event.target.valueAsNumber
                            commitSavedPrice(line.id, kind === "discount" ? -Math.abs(magnitude) : magnitude, line.unit_price)
                          }}
                          className={cn(
                            "w-16 shrink-0 border-0 bg-transparent p-0 text-right tabular-nums focus:outline-none",
                            kind === "discount" && "text-emerald-600 dark:text-emerald-400",
                          )}
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteInvoiceItem.mutate(line.id)}
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    )
                  })
                : localChargeDiscountLines.map((line) => {
                    const fallbackName = line.kind === "discount" ? t("discountLineDefault") : t("chargeLineDefault")
                    const displayPrice = Math.abs(line.unitPrice)
                    return (
                      <div key={line.tempId} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(event) => changeLocalDescription(line.tempId, event.target.value)}
                          onBlur={(event) => {
                            if (!event.target.value.trim()) changeLocalDescription(line.tempId, fallbackName)
                          }}
                          className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-muted-foreground focus:text-foreground focus:outline-none"
                        />
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
                          className={cn(
                            "w-16 shrink-0 border-0 bg-transparent p-0 text-right tabular-nums focus:outline-none",
                            line.kind === "discount" && "text-emerald-600 dark:text-emerald-400",
                          )}
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => changeLocalQuantity(line.tempId, 0)}
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    )
                  })}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => addCustomLine("charge")}>
                  {t("addChargeLine")}
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => addCustomLine("discount")}>
                  {t("addDiscountLine")}
                </Button>
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

            <div className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <CalendarClockIcon className="size-3.5 text-muted-foreground" />
                    {t("emiSectionTitle")}
                  </span>
                  {activeTab.isEmi ? <span className="text-[11px] text-muted-foreground">{t("emiSectionHint")}</span> : null}
                </div>
                <Switch
                  checked={activeTab.isEmi}
                  onCheckedChange={(checked) => updateTab(activeTab.key, { isEmi: checked })}
                />
              </div>
              {activeTab.isEmi ? (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Field className="gap-1">
                      <FieldLabel htmlFor="pos-emi-months" className="text-[11px] text-muted-foreground">
                        {tEmi("monthsLabel")}
                      </FieldLabel>
                      <Input
                        id="pos-emi-months"
                        type="number"
                        min={2}
                        max={60}
                        step={1}
                        value={activeTab.emiMonths}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber
                          updateTab(activeTab.key, { emiMonths: Number.isNaN(value) ? 2 : Math.min(60, Math.max(2, value)) })
                        }}
                        className="h-8 text-xs"
                      />
                    </Field>
                    <Field className="gap-1">
                      <FieldLabel htmlFor="pos-emi-start" className="text-[11px] text-muted-foreground">
                        {tEmi("startDateLabel")}
                      </FieldLabel>
                      <DatePicker
                        id="pos-emi-start"
                        value={activeTab.emiStartDate}
                        onChange={(value) => updateTab(activeTab.key, { emiStartDate: value })}
                        className="h-8 text-xs"
                        container={posContainerEl}
                      />
                    </Field>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {tEmi("previewNote", {
                      months: activeTab.emiMonths,
                      amount: money(activeTab.emiMonths > 0 ? total / activeTab.emiMonths : 0),
                    })}
                  </p>
                </div>
              ) : null}
            </div>

            {!activeTab.isEmi ? (
              <>
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
              </>
            ) : null}

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
        container={posContainerEl}
      />
    </div>
  )
}
