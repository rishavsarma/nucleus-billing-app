import "server-only"

/**
 * Per-entity allow-lists of columns a client may set through the API.
 *
 * Route handlers previously passed the raw request body into `.insert()` /
 * `.update()`, which meant the security of every column depended on whether a
 * database trigger happened to guard it. Where one didn't, the client owned
 * the column — that's how invoice totals became client-writable (audit NB-01)
 * and how `payments.installment_id` reached a SECURITY DEFINER trigger
 * unverified (NB-02).
 *
 * These lists are derived from the live schema (db-schema/dump/tables.sql),
 * with four categories deliberately excluded everywhere:
 *
 *  1. Identity/ownership — `id`, `org_id`, `created_by`, `created_at`,
 *     `updated_at`. Set by the route from the authenticated session, or by the
 *     database. Never from the body.
 *  2. Trigger-derived money — `subtotal`, `tax_total`, `discount_total`,
 *     `total`, `amount_paid`, `round_off_amount` on documents;
 *     `line_subtotal`, `line_tax`, `line_total` on line items. Owned by
 *     billing.recalc_*() and the compute_line_totals_* triggers.
 *  3. Trigger-assigned document numbers — `invoice_number`, `bill_number`,
 *     `credit_note_number`, `debit_note_number`, `sales_return_number`,
 *     `purchase_return_number`. Assigned once on insert; rewriting one breaks
 *     the GST audit trail. (`vendor_invoice_number` is NOT in this category —
 *     it's the vendor's own reference and is legitimately client-supplied.)
 *  4. System/subscription state — `organizations.is_active`,
 *     `subscription_status`, `subscription_current_period_end`; and
 *     `installments.payment_id` / `paid_at`, which billing.installments_mark_paid()
 *     owns.
 *
 * Adding a column to a table does NOT automatically expose it — it has to be
 * added here on purpose. That's the point.
 */
export const ALLOWED_FIELDS = {
  customers: ["name", "email", "phone", "billing_address", "tax_id", "notes"],

  vendors: ["name", "email", "phone", "billing_address", "tax_id", "notes"],

  items: [
    "name",
    "sku",
    "description",
    "hsn_sac_code",
    "unit",
    "unit_price",
    "purchase_price",
    "tax_rate_id",
    "track_inventory",
    "reorder_level",
    "is_active",
  ],

  warehouses: ["name", "address", "is_default"],

  tax_rates: ["name", "rate", "is_default"],

  staff: ["name", "phone", "is_active", "role", "role_label"],

  offers: [
    "name",
    "description",
    "discount_type",
    "value",
    "applies_to_all_items",
    "starts_at",
    "ends_at",
    "is_active",
  ],

  offer_items: ["offer_id", "item_id"],

  pdf_watermarks: ["name", "text", "starts_on", "ends_on", "is_active"],

  organization_bank_accounts: [
    "account_holder_name",
    "account_number",
    "ifsc_code",
    "bank_name",
    "branch_name",
    "is_default",
  ],

  // is_active / subscription_status / subscription_current_period_end are
  // superadmin-only and trigger-guarded — see ORG_SUPERADMIN_FIELDS below.
  organizations: [
    "name",
    "slug",
    "billing_email",
    "default_currency",
    "business_type_id",
    "invoice_prefix",
    "bill_prefix",
    "credit_note_prefix",
    "debit_note_prefix",
    "sales_return_prefix",
    "purchase_return_prefix",
    "gstin",
    "gst_registered",
    "state_code",
    "pan",
    "address",
    "phone",
    "pdf_watermark_text",
    "pdf_logo_url",
    "pdf_footer_notes",
    "signature_image",
    "financial_year_start_month",
    "low_stock_alerts_enabled",
  ],

  memberships: ["user_id", "role", "is_active"],

  invoices: [
    "customer_id",
    "warehouse_id",
    "offer_id",
    "bank_account_id",
    "status",
    "currency",
    "issue_date",
    "due_date",
    "notes",
    "place_of_supply",
    "round_off_enabled",
  ],

  invoice_items: [
    "invoice_id",
    "item_id",
    "item_variant_id",
    "description",
    "quantity",
    "unit_price",
    "tax_rate",
    "sort_order",
  ],

  purchase_bills: [
    "vendor_id",
    "warehouse_id",
    "bank_account_id",
    "vendor_invoice_number",
    "status",
    "currency",
    "bill_date",
    "due_date",
    "notes",
    "place_of_supply",
    "round_off_enabled",
  ],

  purchase_bill_items: [
    "purchase_bill_id",
    "item_id",
    "description",
    "quantity",
    "unit_cost",
    "unit_price",
    "tax_rate",
    "sort_order",
  ],

  credit_notes: ["customer_id", "invoice_id", "status", "issue_date", "reason"],

  credit_note_items: ["credit_note_id", "description", "amount", "tax_rate"],

  debit_notes: [
    "vendor_id",
    "purchase_bill_id",
    "status",
    "issue_date",
    "reason",
  ],

  debit_note_items: ["debit_note_id", "description", "amount", "tax_rate"],

  sales_returns: [
    "invoice_id",
    "customer_id",
    "warehouse_id",
    "status",
    "issue_date",
    "reason",
  ],

  sales_return_items: [
    "sales_return_id",
    "invoice_item_id",
    "item_id",
    "description",
    "quantity",
    "unit_price",
    "tax_rate",
  ],

  purchase_returns: [
    "purchase_bill_id",
    "vendor_id",
    "warehouse_id",
    "status",
    "issue_date",
    "reason",
  ],

  purchase_return_items: [
    "purchase_return_id",
    "purchase_bill_item_id",
    "item_id",
    "description",
    "quantity",
    "unit_cost",
    "tax_rate",
  ],

  payments: [
    "invoice_id",
    "amount",
    "method",
    "reference",
    "notes",
    "paid_at",
    "installment_id",
  ],

  purchase_payments: [
    "purchase_bill_id",
    "amount",
    "method",
    "reference",
    "notes",
    "paid_at",
  ],

  deliveries: [
    "invoice_id",
    "delivery_address",
    "delivery_person_id",
    "payment_mode",
    "status",
    "delivered_at",
    "notes",
  ],

  installment_plans: [
    "invoice_id",
    "total_amount",
    "months",
    "start_date",
    "status",
  ],

  installments: [
    "plan_id",
    "invoice_id",
    "installment_number",
    "due_date",
    "amount",
    "status",
  ],

  // movement_type is forced to 'adjustment' by the route; reference_type,
  // reference_id and the three *_item_id columns are written by the document
  // status triggers, never by a manual adjustment.
  stock_movements: ["item_id", "warehouse_id", "quantity_delta", "notes"],
} as const satisfies Record<string, readonly string[]>

export type AllowedEntity = keyof typeof ALLOWED_FIELDS

/**
 * Fields on `organizations` only a superadmin may set. Both are additionally
 * guarded by BEFORE UPDATE triggers in the database
 * (organizations_active_change_guard, organizations_subscription_change_guard,
 * organizations_period_end_change_guard), so this is the friendly 403 rather
 * than the last line of defence.
 */
export const ORG_SUPERADMIN_FIELDS = [
  "is_active",
  "subscription_status",
  "subscription_current_period_end",
] as const

/**
 * Returns a copy of `body` containing only the entity's allow-listed keys.
 * Unknown keys are dropped silently rather than rejected — a client sending a
 * stale or extra field gets the write it asked for on the fields it's allowed
 * to set, which is what the existing UI expects (it round-trips whole objects
 * from GET responses, derived columns included).
 */
export function pickAllowed<E extends AllowedEntity>(
  entity: E,
  body: unknown
): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {}
  const allowed = ALLOWED_FIELDS[entity] as readonly string[]
  const source = body as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key))
      out[key] = source[key]
  }
  return out
}
