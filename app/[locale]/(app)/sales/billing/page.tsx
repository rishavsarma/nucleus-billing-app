"use client"

import { useState } from "react"
import { isAxiosError } from "axios"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { MinusIcon, PlusIcon, SearchIcon, TrashIcon, UserPlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { QuickAddCustomerDialog } from "@/components/quick-add-customer-dialog"
import { RecordPaymentDialog } from "@/components/record-payment-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useCreateCustomer, useCustomers } from "@/hooks/use-customers"
import { useCreateInvoiceItem, useDeleteInvoiceItem, useInvoiceItems, useUpdateInvoiceItem } from "@/hooks/use-invoice-items"
import { useCreateInvoice, useInvoices, useUpdateInvoice } from "@/hooks/use-invoices"
import { useItems } from "@/hooks/use-items"
import { useCreatePayment } from "@/hooks/use-payments"
import { useTaxRates } from "@/hooks/use-tax-rates"
import { useWarehouses } from "@/hooks/use-warehouses"
import type { Item, Payment } from "@/lib/database/types"

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const PAYMENT_METHODS = ["manual", "bank_transfer", "cash", "upi", "razorpay"]

// Not translated: this is a data value stored as a real customers.name row
// (matched by exact string below), not UI copy — translating it would create
// a separate "Guest Customer" per locale instead of one reusable row per org.
const GUEST_CUSTOMER_NAME = "Guest Customer"

type CartLine = {
  tempId: string
  itemId: string
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
}

type PosTab = {
  key: string
  invoiceId: string | null
  customerId: string | null
  warehouseId: string | null
  lines: CartLine[]
}

function newTab(): PosTab {
  return { key: crypto.randomUUID(), invoiceId: null, customerId: null, warehouseId: null, lines: [] }
}

function lineTotals(lines: CartLine[]) {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  const tax = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice * l.taxRate) / 100, 0)
  return { subtotal, tax, total: subtotal + tax }
}

export default function BillingPosPage() {
  const t = useTranslations("BillingPos")
  const tCommon = useTranslations("Common")

  const { data: items } = useItems()
  const { data: customers } = useCustomers()
  const { data: warehouses } = useWarehouses()
  const { data: taxRates } = useTaxRates()
  const { data: invoices } = useInvoices()
  const createInvoice = useCreateInvoice()
  const createInvoiceItem = useCreateInvoiceItem()
  const updateInvoiceItem = useUpdateInvoiceItem(undefined)
  const deleteInvoiceItem = useDeleteInvoiceItem(undefined)
  const updateInvoice = useUpdateInvoice()
  const createPayment = useCreatePayment()
  const createCustomer = useCreateCustomer()

  const [tabs, setTabs] = useState<PosTab[]>([newTab()])
  const [activeKey, setActiveKey] = useState(tabs[0].key)
  const [search, setSearch] = useState("")
  const [showRecordPayment, setShowRecordPayment] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const activeTab = tabs.find((tab) => tab.key === activeKey)!
  const activeInvoice = invoices?.find((inv) => inv.id === activeTab.invoiceId)
  const { data: savedCartItems } = useInvoiceItems(activeTab.invoiceId ?? undefined)
  const isDraftSaved = !!activeTab.invoiceId

  const localTotals = lineTotals(activeTab.lines)
  const subtotal = isDraftSaved ? (activeInvoice?.subtotal ?? 0) : localTotals.subtotal
  const tax = isDraftSaved ? (activeInvoice?.tax_total ?? 0) : localTotals.tax
  const total = isDraftSaved ? (activeInvoice?.total ?? 0) : localTotals.total

  function updateTab(key: string, patch: Partial<PosTab>) {
    setTabs((prev) => prev.map((tab) => (tab.key === key ? { ...tab, ...patch } : tab)))
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

  function addItemToCart(item: Item) {
    const taxRate = taxRates?.find((r) => r.id === item.tax_rate_id)?.rate ?? 0

    if (!isDraftSaved) {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.key !== activeTab.key) return tab
          const existing = tab.lines.find((l) => l.itemId === item.id)
          if (existing) {
            return {
              ...tab,
              lines: tab.lines.map((l) => (l.itemId === item.id ? { ...l, quantity: l.quantity + 1 } : l)),
            }
          }
          return {
            ...tab,
            lines: [
              ...tab.lines,
              {
                tempId: crypto.randomUUID(),
                itemId: item.id,
                description: item.name,
                quantity: 1,
                unitPrice: item.unit_price,
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
    const existingLine = savedCartItems?.find((line) => line.item_id === item.id)
    if (existingLine) {
      updateInvoiceItem.mutate({ id: existingLine.id, input: { quantity: existingLine.quantity + 1 } })
    } else {
      createInvoiceItem.mutate({
        invoice_id: activeTab.invoiceId!,
        item_id: item.id,
        description: item.name,
        quantity: 1,
        unit_price: item.unit_price,
        tax_rate: taxRate,
      })
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
      issue_date: new Date().toISOString().slice(0, 10),
    })
    for (const line of activeTab.lines) {
      await createInvoiceItem.mutateAsync({
        invoice_id: invoice.id,
        item_id: line.itemId,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        tax_rate: line.taxRate,
      })
    }
    updateTab(activeTab.key, { invoiceId: invoice.id, customerId, lines: [] })
    return invoice.id
  }

  async function saveAsDraft() {
    if (isDraftSaved || !activeTab.lines.length) return
    setIsSaving(true)
    try {
      await ensureDraftSaved()
      toast.success(t("draftSaved"))
    } catch {
      toast.error(tCommon("genericError"))
    } finally {
      setIsSaving(false)
    }
  }

  async function completeSale() {
    if (!isDraftSaved && !activeTab.lines.length) return
    setIsSaving(true)
    try {
      const invoiceId = await ensureDraftSaved()
      updateInvoice.mutate(
        { id: invoiceId, input: { status: "sent", warehouse_id: activeTab.warehouseId } },
        {
          onSuccess: () => setShowRecordPayment(true),
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

  const selectedCustomerName = customers?.find((c) => c.id === activeTab.customerId)?.name

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab, index) => (
          <div
            key={tab.key}
            onClick={() => setActiveKey(tab.key)}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm ring-1 ring-foreground/10",
              tab.key === activeKey ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            <span>
              {t("newTab")} {index + 1}
            </span>
            <button
              type="button"
              title={t("closeTab")}
              onClick={(event) => {
                event.stopPropagation()
                closeTab(tab.key)
              }}
              className="opacity-70 hover:opacity-100"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}
        <Button variant="outline" size="icon-sm" onClick={addTab}>
          <PlusIcon />
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
        <div className="col-span-2 flex min-h-0 flex-col gap-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 start-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="ps-8"
            />
          </div>
          <div className="grid flex-1 auto-rows-min grid-cols-3 gap-3 overflow-y-auto pr-1">
            {filteredItems.length ? (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addItemToCart(item)}
                  className="flex flex-col items-start gap-1 rounded-xl bg-card p-3 text-left ring-1 ring-foreground/10 hover:ring-primary"
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{t("unitPrice", { price: money(item.unit_price) })}</span>
                </button>
              ))
            ) : (
              <p className="col-span-3 py-8 text-center text-sm text-muted-foreground">{t("noItems")}</p>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2">
            <Select
              value={activeTab.customerId ?? undefined}
              onValueChange={(value) => updateTab(activeTab.key, { customerId: value })}
              disabled={isDraftSaved}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("customerPlaceholder")}>{selectedCustomerName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={t("addCustomer")}
              disabled={isDraftSaved}
              onClick={() => setShowAddCustomer(true)}
            >
              <UserPlusIcon />
            </Button>
          </div>
          <Select
            value={activeTab.warehouseId ?? undefined}
            onValueChange={(value) => updateTab(activeTab.key, { warehouseId: value })}
          >
            <SelectTrigger className="w-full">
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

          <h2 className="text-sm font-semibold">{t("cartTitle")}</h2>

          <div className="flex-1 overflow-y-auto">
            {isDraftSaved ? (
              savedCartItems?.length ? (
                <div className="flex flex-col gap-2">
                  {savedCartItems.map((line) => (
                    <div key={line.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{line.description}</span>
                        <span className="text-xs text-muted-foreground">{money(line.unit_price)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => changeSavedQuantity(line.id, line.quantity - 1)}>
                          <MinusIcon />
                        </Button>
                        <span className="w-6 text-center">{line.quantity}</span>
                        <Button variant="ghost" size="icon-sm" onClick={() => changeSavedQuantity(line.id, line.quantity + 1)}>
                          <PlusIcon />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => deleteInvoiceItem.mutate(line.id)}>
                          <TrashIcon />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("emptyCart")}</p>
              )
            ) : activeTab.lines.length ? (
              <div className="flex flex-col gap-2">
                {activeTab.lines.map((line) => (
                  <div key={line.tempId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{line.description}</span>
                      <span className="text-xs text-muted-foreground">{money(line.unitPrice)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => changeLocalQuantity(line.tempId, line.quantity - 1)}>
                        <MinusIcon />
                      </Button>
                      <span className="w-6 text-center">{line.quantity}</span>
                      <Button variant="ghost" size="icon-sm" onClick={() => changeLocalQuantity(line.tempId, line.quantity + 1)}>
                        <PlusIcon />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => changeLocalQuantity(line.tempId, 0)}>
                        <TrashIcon />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("emptyCart")}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("subtotalLabel")}</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("taxLabel")}</span>
              <span>{money(tax)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>{t("totalLabel")}</span>
              <span>{money(total)}</span>
            </div>
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

      <QuickAddCustomerDialog
        open={showAddCustomer}
        onOpenChange={setShowAddCustomer}
        onCreated={(customerId) => updateTab(activeTab.key, { customerId })}
      />

      <RecordPaymentDialog
        open={showRecordPayment}
        onOpenChange={setShowRecordPayment}
        methods={PAYMENT_METHODS}
        balanceDue={activeInvoice?.total ?? 0}
        isSubmitting={createPayment.isPending}
        onSubmit={(values) => {
          if (!activeTab.invoiceId) return
          createPayment.mutate(
            {
              invoice_id: activeTab.invoiceId,
              amount: values.amount,
              method: values.method as Payment["method"],
              reference: values.reference || null,
              notes: values.notes || null,
              paid_at: values.paid_at,
            },
            {
              onSuccess: () => {
                toast.success(t("saleCompleted"))
                setShowRecordPayment(false)
                closeTab(activeTab.key)
              },
              onError: () => toast.error(tCommon("genericError")),
            },
          )
        }}
      />
    </div>
  )
}
