-- ============================================================================
-- 016 — Comprehensive Performance Optimization: Composite B-Tree & Foreign Key Indexes
-- ============================================================================
-- Problem:
--   1. Sorting by created_at DESC with org_id scoping causes PostgreSQL to
--      perform Sort operations in memory or disk on unindexed tables.
--   2. Foreign key columns in PostgreSQL are not automatically indexed,
--      slowing down joins and child table lookups during invoice/bill views.
--   3. Document number searches (%term%) on purchase bills, returns, and notes
--      trigger sequential scans without GIN Trigram indexes.
--
-- Solution:
--   1. Create composite B-Tree indexes (org_id, created_at DESC) on all tables.
--   2. Create indexes on all high-traffic foreign key columns.
--   3. Create pg_trgm GIN indexes for all document numbers.
-- ============================================================================

-- 1. Composite (org_id, created_at DESC) Sorting & Pagination Indexes
create index if not exists purchase_bills_org_created_desc_idx
  on billing.purchase_bills (org_id, created_at desc);

create index if not exists sales_returns_org_created_desc_idx
  on billing.sales_returns (org_id, created_at desc);

create index if not exists purchase_returns_org_created_desc_idx
  on billing.purchase_returns (org_id, created_at desc);

create index if not exists credit_notes_org_created_desc_idx
  on billing.credit_notes (org_id, created_at desc);

create index if not exists debit_notes_org_created_desc_idx
  on billing.debit_notes (org_id, created_at desc);

create index if not exists stock_movements_org_created_desc_idx
  on billing.stock_movements (org_id, created_at desc);

create index if not exists staff_org_created_desc_idx
  on billing.staff (org_id, created_at desc);

create index if not exists warehouses_org_created_desc_idx
  on billing.warehouses (org_id, created_at desc);

create index if not exists offers_org_created_desc_idx
  on billing.offers (org_id, created_at desc);

create index if not exists tax_rates_org_created_desc_idx
  on billing.tax_rates (org_id, created_at desc);

create index if not exists pdf_watermarks_org_created_desc_idx
  on billing.pdf_watermarks (org_id, created_at desc);

create index if not exists memberships_org_created_desc_idx
  on billing.memberships (org_id, created_at desc);

-- 2. Foreign Key & Child Line Items Indexes
create index if not exists invoice_items_invoice_id_idx
  on billing.invoice_items (invoice_id);

create index if not exists purchase_bill_items_bill_id_idx
  on billing.purchase_bill_items (purchase_bill_id);

create index if not exists sales_return_items_return_id_idx
  on billing.sales_return_items (sales_return_id);

create index if not exists purchase_return_items_return_id_idx
  on billing.purchase_return_items (purchase_return_id);

create index if not exists credit_note_items_note_id_idx
  on billing.credit_note_items (credit_note_id);

create index if not exists debit_note_items_note_id_idx
  on billing.debit_note_items (debit_note_id);

create index if not exists offer_items_offer_id_idx
  on billing.offer_items (offer_id);

create index if not exists deliveries_invoice_id_idx
  on billing.deliveries (invoice_id);

create index if not exists installment_plans_invoice_id_idx
  on billing.installment_plans (invoice_id);

create index if not exists installments_plan_id_idx
  on billing.installments (plan_id, due_date);

create index if not exists item_variants_fifo_lookup_idx
  on billing.item_variants (org_id, item_id, warehouse_id, quantity_remaining)
  where quantity_remaining > 0;

create index if not exists item_stock_lookup_idx
  on billing.item_stock (item_id, warehouse_id);

create index if not exists memberships_user_org_idx
  on billing.memberships (user_id, org_id);

-- 3. Document Number Trigram GIN Search Indexes
create extension if not exists pg_trgm;

create index if not exists purchase_bills_number_trgm_idx
  on billing.purchase_bills using gin (
    org_id,
    bill_number gin_trgm_ops
  );

create index if not exists sales_returns_number_trgm_idx
  on billing.sales_returns using gin (
    org_id,
    sales_return_number gin_trgm_ops
  );

create index if not exists purchase_returns_number_trgm_idx
  on billing.purchase_returns using gin (
    org_id,
    purchase_return_number gin_trgm_ops
  );

create index if not exists credit_notes_number_trgm_idx
  on billing.credit_notes using gin (
    org_id,
    credit_note_number gin_trgm_ops
  );

create index if not exists debit_notes_number_trgm_idx
  on billing.debit_notes using gin (
    org_id,
    debit_note_number gin_trgm_ops
  );

do $$
begin
  raise notice '✅ Performance composite B-Tree, Foreign Key, and Trigram indexes created successfully!';
end $$;
