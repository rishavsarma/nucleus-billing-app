// Row types mirroring schema.sql (billing schema). Kept as plain interfaces
// since this project has no generated Supabase types yet.

export interface Organization {
  id: string
  name: string
  slug: string | null
  billing_email: string | null
  default_currency: string
  invoice_prefix: string
  bill_prefix: string
  credit_note_prefix: string
  debit_note_prefix: string
  gstin: string | null
  gst_registered: boolean
  state_code: string | null
  pdf_watermark_text: string | null
  pdf_logo_url: string | null
  pdf_footer_notes: string | null
  financial_year_start_month: number
  low_stock_alerts_enabled: boolean
  is_active: boolean
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

export interface CreditNote {
  id: string
  org_id: string
  invoice_id: string
  customer_id: string
  warehouse_id: string | null
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

export interface CreditNoteItem {
  id: string
  credit_note_id: string
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
  tax_rate: number
  line_subtotal: number
  line_tax: number
  line_total: number
  sort_order: number
  created_at: string
}

export interface DebitNote {
  id: string
  org_id: string
  purchase_bill_id: string
  vendor_id: string
  warehouse_id: string | null
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

export interface DebitNoteItem {
  id: string
  debit_note_id: string
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
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface ItemStock {
  item_id: string
  warehouse_id: string
  quantity_on_hand: number
}

export interface OrgDocumentCounter {
  org_id: string
  doc_type: "invoice" | "purchase_bill" | "credit_note" | "debit_note"
  next_value: number
}
