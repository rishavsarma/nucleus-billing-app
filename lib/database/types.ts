// Row types mirroring db-schema/*.sql (billing schema). Kept as plain
// interfaces since this project has no generated Supabase types yet.

export interface Organization {
  id: string
  name: string
  slug: string | null
  billing_email: string | null
  default_currency: string
  business_type_id: string | null
  invoice_prefix: string
  bill_prefix: string
  credit_note_prefix: string
  debit_note_prefix: string
  sales_return_prefix: string
  purchase_return_prefix: string
  gstin: string | null
  gst_registered: boolean
  state_code: string | null
  pan: string | null
  address: string | null
  phone: string | null
  pdf_watermark_text: string | null
  pdf_logo_url: string | null
  pdf_footer_notes: string | null
  financial_year_start_month: number
  low_stock_alerts_enabled: boolean
  is_active: boolean
  subscription_status: "trialing" | "active" | "past_due" | "cancelled"
  subscription_current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface BusinessType {
  id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface Addon {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  min_commitment_days: number
  is_active: boolean
  created_at: string
}

export interface OrganizationAddonSubscription {
  id: string
  org_id: string
  addon_id: string
  status: "active" | "cancelled"
  started_at: string
  min_commitment_until: string
  cancelled_at: string | null
  renews_at: string | null
  created_at: string
  updated_at: string
}

export interface Superadmin {
  user_id: string
  created_at: string
}

export interface Membership {
  id: string
  org_id: string
  user_id: string
  role: "owner" | "admin" | "member"
  created_at: string
}

export interface Customer {
  id: string
  org_id: string
  name: string
  email: string | null
  phone: string | null
  billing_address: Record<string, unknown> | null
  tax_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Vendor {
  id: string
  org_id: string
  name: string
  email: string | null
  phone: string | null
  billing_address: Record<string, unknown> | null
  tax_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  org_id: string
  name: string
  sku: string | null
  description: string | null
  hsn_sac_code: string | null
  unit: string
  unit_price: number
  purchase_price: number
  tax_rate_id: string | null
  track_inventory: boolean
  reorder_level: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TaxRate {
  id: string
  org_id: string
  name: string
  rate: number
  is_default: boolean
  created_at: string
}

export interface Warehouse {
  id: string
  org_id: string
  name: string
  address: Record<string, unknown> | null
  is_default: boolean
  created_at: string
}

export interface Offer {
  id: string
  org_id: string
  name: string
  description: string | null
  discount_type: "percentage" | "flat"
  value: number
  applies_to_all_items: boolean
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OfferItem {
  offer_id: string
  item_id: string
}

export interface Invoice {
  id: string
  org_id: string
  customer_id: string
  warehouse_id: string | null
  offer_id: string | null
  invoice_number: string | null
  status: "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "void"
  currency: string
  issue_date: string
  due_date: string | null
  notes: string | null
  subtotal: number
  tax_total: number
  discount_total: number
  total: number
  amount_paid: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  item_id: string | null
  item_variant_id: string | null
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_subtotal: number
  line_tax: number
  line_total: number
  sort_order: number
  created_at: string
}

// Pure value adjustment (price correction, goodwill credit, shortage
// claim) — never touches inventory. invoice_id is optional context, not a
// restocking link. Physical returns-with-restocking live in SalesReturn
// instead — see db-schema/010_returns_split.sql for the split rationale.
export interface CreditNote {
  id: string
  org_id: string
  customer_id: string
  invoice_id: string | null
  credit_note_number: string | null
  status: "draft" | "issued" | "void"
  issue_date: string
  reason: string | null
  subtotal: number
  tax_total: number
  total: number
  created_by: string | null
  created_at: string
  updated_at: string
}

// A line is a signed amount, not a quantity*price — no item_id/quantity at
// all, since this never represents real goods.
export interface CreditNoteItem {
  id: string
  credit_note_id: string
  description: string
  amount: number
  tax_rate: number
  line_subtotal: number
  line_tax: number
  line_total: number
  created_at: string
}

export interface PurchaseBill {
  id: string
  org_id: string
  vendor_id: string
  warehouse_id: string | null
  bill_number: string | null
  vendor_invoice_number: string | null
  status: "draft" | "received" | "partially_paid" | "paid" | "void"
  currency: string
  bill_date: string
  due_date: string | null
  notes: string | null
  subtotal: number
  tax_total: number
  total: number
  amount_paid: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseBillItem {
  id: string
  purchase_bill_id: string
  item_id: string | null
  description: string
  quantity: number
  unit_cost: number
  unit_price: number
  tax_rate: number
  line_subtotal: number
  line_tax: number
  line_total: number
  sort_order: number
  created_at: string
}

// Pure value adjustment — the debit-note mirror of CreditNote above. See
// db-schema/010_returns_split.sql. purchase_bill_id is optional context,
// not a restocking link — physical returns live in PurchaseReturn instead.
export interface DebitNote {
  id: string
  org_id: string
  vendor_id: string
  purchase_bill_id: string | null
  debit_note_number: string | null
  status: "draft" | "issued" | "void"
  issue_date: string
  reason: string | null
  subtotal: number
  tax_total: number
  total: number
  created_by: string | null
  created_at: string
  updated_at: string
}

// A line is a signed amount, not a quantity*cost — no item_id/quantity at
// all, since this never represents real goods.
export interface DebitNoteItem {
  id: string
  debit_note_id: string
  description: string
  amount: number
  tax_rate: number
  line_subtotal: number
  line_tax: number
  line_total: number
  created_at: string
}

// A physical return with restocking — what CreditNote used to be before
// the returns split (db-schema/010_returns_split.sql). Always tied to a
// real invoice and (for tracked items) a warehouse, since issuing one
// moves real inventory.
export interface SalesReturn {
  id: string
  org_id: string
  invoice_id: string
  customer_id: string
  warehouse_id: string | null
  sales_return_number: string | null
  status: "draft" | "issued" | "void"
  issue_date: string
  reason: string | null
  subtotal: number
  tax_total: number
  total: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SalesReturnItem {
  id: string
  sales_return_id: string
  invoice_item_id: string | null
  item_id: string | null
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_subtotal: number
  line_tax: number
  line_total: number
  created_at: string
}

// A physical return with restocking — what DebitNote used to be before
// the returns split. See SalesReturn above.
export interface PurchaseReturn {
  id: string
  org_id: string
  purchase_bill_id: string
  vendor_id: string
  warehouse_id: string | null
  purchase_return_number: string | null
  status: "draft" | "issued" | "void"
  issue_date: string
  reason: string | null
  subtotal: number
  tax_total: number
  total: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseReturnItem {
  id: string
  purchase_return_id: string
  purchase_bill_item_id: string | null
  item_id: string | null
  description: string
  quantity: number
  unit_cost: number
  tax_rate: number
  line_subtotal: number
  line_tax: number
  line_total: number
  created_at: string
}

export interface Payment {
  id: string
  org_id: string
  invoice_id: string
  amount: number
  method: "manual" | "bank_transfer" | "cash" | "upi" | "razorpay"
  reference: string | null
  notes: string | null
  paid_at: string
  installment_id: string | null
  created_by: string | null
  created_at: string
}

export interface PurchasePayment {
  id: string
  org_id: string
  purchase_bill_id: string
  amount: number
  method: "bank_transfer" | "cash" | "upi" | "cheque" | "other"
  reference: string | null
  notes: string | null
  paid_at: string
  created_by: string | null
  created_at: string
}

export interface StockMovement {
  id: string
  org_id: string
  item_id: string
  warehouse_id: string
  quantity_delta: number
  movement_type:
    | "purchase"
    | "purchase_void"
    | "sale"
    | "sale_void"
    | "sales_return"
    | "sales_return_void"
    | "purchase_return"
    | "purchase_return_void"
    | "adjustment"
  reference_type: string | null
  reference_id: string | null
  invoice_item_id: string | null
  purchase_bill_item_id: string | null
  sales_return_item_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface ItemStock {
  item_id: string
  warehouse_id: string
  quantity_on_hand: number
}

// One row per (item, warehouse) with the item fields the Stock list page
// needs pre-joined server-side — avoids fetching every item and firing one
// item_stock lookup per item client-side.
export interface ItemStockRow {
  item_id: string
  warehouse_id: string
  quantity_on_hand: number
  item_name: string
  item_sku: string | null
  item_reorder_level: number
}

// One row per purchase receiving event for a track_inventory item —
// carries both cost and selling price, always entered together at purchase
// time. quantity_remaining is mutated only by the *_stock_effect() DB
// triggers (security definer); never write to it directly.
export interface ItemVariant {
  id: string
  org_id: string
  item_id: string
  warehouse_id: string
  unit_cost: number
  unit_price: number
  quantity_received: number
  quantity_remaining: number
  reference_type: "purchase_bill_item" | "opening_balance"
  reference_id: string | null
  received_at: string
  created_by: string | null
  created_at: string
}

export interface StockMovementVariant {
  id: string
  stock_movement_id: string
  item_variant_id: string
  quantity: number
  sort_order: number
  created_at: string
}

export interface OrgDocumentCounter {
  org_id: string
  doc_type: "invoice" | "purchase_bill" | "credit_note" | "debit_note" | "sales_return" | "purchase_return"
  next_value: number
}

// Not tied to auth.users — a name in a dropdown, not a login role.
export interface DeliveryPerson {
  id: string
  org_id: string
  name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

// One per invoice — operational tracking, not a financial document, so
// status moves freely (see db-schema/005_delivery_and_public_pricing.sql).
export interface Delivery {
  id: string
  org_id: string
  invoice_id: string
  delivery_address: Record<string, unknown> | null
  delivery_person_id: string | null
  payment_mode: "cod" | "prepaid" | null
  status: "pending" | "out_for_delivery" | "delivered" | "failed"
  delivered_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// One per invoice (v1, sales-only) — see db-schema/008_emi_installments.sql.
export interface InstallmentPlan {
  id: string
  org_id: string
  invoice_id: string
  total_amount: number
  months: number
  start_date: string
  status: "active" | "completed" | "cancelled"
  created_by: string | null
  created_at: string
}

// status only ever stores "pending"/"paid" — "overdue" is derived at read
// time (pending && due_date < today), never stored. See the migration's
// comment for why.
export interface Installment {
  id: string
  org_id: string
  plan_id: string
  invoice_id: string
  installment_number: number
  due_date: string
  amount: number
  status: "pending" | "paid"
  payment_id: string | null
  paid_at: string | null
  created_at: string
}

// Date-range watermark preset — see db-schema/009_pdf_watermarks.sql.
export interface PdfWatermark {
  id: string
  org_id: string
  name: string
  text: string
  starts_on: string
  ends_on: string
  is_active: boolean
  created_at: string
}
