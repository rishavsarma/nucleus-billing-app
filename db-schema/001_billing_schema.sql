-- ============================================================================
-- nucleus-billing — core schema v3
-- Supersedes v2. There's no real data behind v2 yet, so this is a clean
-- rewrite rather than a migration — see APPLY.md, step 0: `drop schema
-- billing cascade;` first, then apply 001-004 below in order. There is no
-- separate 005 patch file in this version — v2's 005_superadmin.sql is
-- fully folded in here and in 002/003 (organizations.is_active,
-- billing.superadmins, and the superadmin-aware helper functions all ship
-- natively now, plus the new subscription/add-on layer described below).
--
-- What's new in v3, on top of everything v2 already had (tenancy, parties,
-- catalog/inventory, offers, sales, sales returns, purchases, purchase
-- returns — all unchanged below):
--
--   1. Base-plan subscription gating. An org now has a subscription_status
--      independent of is_active — is_active is a superadmin ban switch,
--      subscription_status is "did they pay for the base plan." Both are
--      checked by is_org_member()/is_org_admin() in 003, so this one change
--      covers every existing table with no per-table edits needed.
--   2. Business types. A small catalog (billing.business_types) an org
--      picks from at onboarding, purely for default-setup and add-on
--      recommendation purposes — not itself security-enforced.
--   3. Add-on marketplace. billing.addons (catalog) +
--      billing.organization_addon_subscriptions (entitlement table) +
--      billing.org_has_addon() (the enforcement choke point, in 003) give
--      any future feature a ready-made way to gate itself behind a paid
--      add-on, the same way tables today gate themselves behind org
--      membership.
--
-- See SYSTEM_DESIGN.md for the full writeup of how these compose.
-- ============================================================================

create schema if not exists billing;
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ============================================================================
-- SECTION 1 — Tenancy
-- ============================================================================

-- business_types is defined before organizations so organizations can carry
-- a direct FK to it. Purely a catalog/onboarding concept — nothing reads
-- this table for access control.
create table billing.business_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  is_active   boolean not null default true,  -- superadmin can retire one from new signups without deleting history
  created_at  timestamptz not null default now()
);

comment on table billing.business_types is
  'Catalog of business types shown at onboarding (Retail, Pharmacy, ...). Drives default setup and add-on recommendations only — never used for access control.';

create table billing.organizations (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  slug                      text unique,
  billing_email             text,
  default_currency          text not null default 'INR',
  business_type_id          uuid references billing.business_types(id) on delete set null,

  -- Document numbering prefixes
  invoice_prefix            text not null default 'INV',
  bill_prefix               text not null default 'BILL',
  credit_note_prefix        text not null default 'CN',
  debit_note_prefix         text not null default 'DN',

  -- GST / tax settings
  gstin                     text,
  gst_registered            boolean not null default false,
  state_code                text,  -- GST place-of-supply state code, e.g. '27' for Maharashtra

  -- PDF / document appearance settings
  pdf_watermark_text        text,  -- e.g. 'COPY', 'PAID' — null means no watermark
  pdf_logo_url              text,
  pdf_footer_notes          text,  -- default terms & conditions shown on invoice/bill PDFs

  -- Misc app settings
  financial_year_start_month int not null default 4 check (financial_year_start_month between 1 and 12),
  low_stock_alerts_enabled  boolean not null default true,

  -- Platform-level: only a superadmin can flip this (see 003's
  -- organizations_active_change_guard trigger). An inactive org's own
  -- members lose access to every table scoped by is_org_member/
  -- is_org_admin — this is a real suspend switch, not just a display flag.
  is_active                 boolean not null default true,

  -- Base-plan billing state — independent of is_active. is_active is a
  -- manual ban switch; this is "did they pay." Only a superadmin can change
  -- it (see 003's organizations_subscription_change_guard trigger), and
  -- only 'trialing'/'active' count as usable — is_org_member()/
  -- is_org_admin() in 003 require this alongside is_active, so an org
  -- that's 'past_due' or 'cancelled' loses access to everything, the same
  -- way a deactivated org does. No payment gateway is wired up yet, so this
  -- is set manually for now; the column is shaped so a webhook can drive it
  -- later without a redesign.
  subscription_status       text not null default 'trialing'
                               check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled')),
  subscription_current_period_end timestamptz,  -- when the current paid (or trial) period ends

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table billing.organizations is
  'A tenant / business account. Everything else in this schema hangs off org_id. Also doubles as the app-settings row (GST, PDF, prefixes).';

create index organizations_business_type_id_idx on billing.organizations (business_type_id);

create table billing.memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references billing.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- Platform superadmins — sees every org's data, is treated as an admin of
-- every org (see is_org_member()/is_org_admin() in 003), and is the only
-- one who can create an organization, flip its is_active flag, change its
-- subscription_status, or subscribe/cancel its add-ons. There is
-- deliberately no INSERT/UPDATE/DELETE policy on this table anywhere in
-- 003 — granting superadmin status is a manual DBA action done directly
-- in the SQL editor (as the postgres/service_role, which bypasses RLS),
-- never something reachable through the app's own API. That's the point:
-- if it were self-service through the API, anyone could grant it to
-- themselves.
create table billing.superadmins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- SECTION 2 — Parties (customers & vendors)
-- ============================================================================

create table billing.customers (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references billing.organizations(id) on delete cascade,
  name            text not null,
  email           text,
  phone           text,
  billing_address jsonb,
  tax_id          text,  -- e.g. GSTIN
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index customers_org_id_idx on billing.customers (org_id);

create table billing.vendors (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references billing.organizations(id) on delete cascade,
  name            text not null,
  email           text,
  phone           text,
  billing_address jsonb,
  tax_id          text,
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index vendors_org_id_idx on billing.vendors (org_id);

-- ============================================================================
-- SECTION 3 — Catalog & inventory
-- ============================================================================

create table billing.tax_rates (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references billing.organizations(id) on delete cascade,
  name       text not null,
  rate       numeric(5, 2) not null check (rate >= 0 and rate <= 100),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index tax_rates_org_id_idx on billing.tax_rates (org_id);

create table billing.warehouses (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references billing.organizations(id) on delete cascade,
  name       text not null,
  address    jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index warehouses_org_id_idx on billing.warehouses (org_id);

-- items — was "products" in v1. Renamed since it now covers full inventory,
-- not just a price list. A service (non-stock) item is just track_inventory = false.
create table billing.items (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references billing.organizations(id) on delete cascade,
  name             text not null,
  sku              text,
  description      text,
  hsn_sac_code     text,  -- GST HSN (goods) / SAC (services) code
  unit             text not null default 'pcs',
  unit_price       numeric(14, 2) not null default 0,  -- default selling price
  purchase_price   numeric(14, 2) not null default 0,  -- default cost, prefills purchase bills
  tax_rate_id      uuid references billing.tax_rates(id) on delete set null,
  track_inventory  boolean not null default true,
  reorder_level    numeric(14, 4) not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index items_org_id_idx on billing.items (org_id);
create unique index items_org_sku_unique on billing.items (org_id, sku) where sku is not null;

-- item_stock — materialized running balance per item per warehouse. Always
-- derived from stock_movements (never written to directly by the app).
create table billing.item_stock (
  item_id           uuid not null references billing.items(id) on delete cascade,
  warehouse_id      uuid not null references billing.warehouses(id) on delete cascade,
  quantity_on_hand  numeric(14, 4) not null default 0,
  primary key (item_id, warehouse_id)
);

-- stock_movements — the append-only ledger. Every stock change, in either
-- direction, is a row here; item_stock is just a fast-read cache of the sum.
create table billing.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references billing.organizations(id) on delete cascade,
  item_id        uuid not null references billing.items(id) on delete restrict,
  warehouse_id   uuid not null references billing.warehouses(id) on delete restrict,
  quantity_delta numeric(14, 4) not null check (quantity_delta <> 0),
  movement_type  text not null check (movement_type in (
                   'purchase', 'purchase_void',
                   'sale', 'sale_void',
                   'sales_return', 'sales_return_void',
                   'purchase_return', 'purchase_return_void',
                   'adjustment'
                 )),
  reference_type text,  -- 'invoice' | 'purchase_bill' | 'credit_note' | 'debit_note' | 'manual'
  reference_id   uuid,
  notes          text,
  created_by     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now()
);

create index stock_movements_org_id_idx on billing.stock_movements (org_id);
create index stock_movements_item_warehouse_idx on billing.stock_movements (item_id, warehouse_id);
create index stock_movements_reference_idx on billing.stock_movements (reference_type, reference_id);

comment on table billing.stock_movements is
  'Append-only ledger. Rows are never updated or deleted (enforced by trigger) — to correct a mistake, insert an offsetting movement.';

-- ============================================================================
-- SECTION 4 — Offers
-- ============================================================================

create table billing.offers (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references billing.organizations(id) on delete cascade,
  name                  text not null,
  description           text,
  discount_type         text not null check (discount_type in ('percentage', 'flat')),
  value                 numeric(14, 2) not null check (value >= 0),
  applies_to_all_items  boolean not null default true,
  starts_at             date,
  ends_at               date,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index offers_org_id_idx on billing.offers (org_id);

-- Which items an offer applies to, when applies_to_all_items = false. Not
-- enforced against invoice line items by the database in v1 — that's an
-- app-level check (show only eligible offers for the items on the invoice).
create table billing.offer_items (
  offer_id uuid not null references billing.offers(id) on delete cascade,
  item_id  uuid not null references billing.items(id) on delete cascade,
  primary key (offer_id, item_id)
);

-- ============================================================================
-- SECTION 5 — Document numbering (shared by invoices/bills/credit/debit notes)
-- ============================================================================

create table billing.org_document_counters (
  org_id     uuid not null references billing.organizations(id) on delete cascade,
  doc_type   text not null check (doc_type in ('invoice', 'purchase_bill', 'credit_note', 'debit_note')),
  next_value int not null default 1,
  primary key (org_id, doc_type)
);

create or replace function billing.next_document_number(p_org_id uuid, p_doc_type text, p_prefix text)
returns text
language plpgsql
security definer
set search_path = billing, public
as $$
declare
  v_value int;
begin
  insert into billing.org_document_counters (org_id, doc_type) values (p_org_id, p_doc_type)
    on conflict (org_id, doc_type) do nothing;

  update billing.org_document_counters
    set next_value = next_value + 1
    where org_id = p_org_id and doc_type = p_doc_type
    returning next_value - 1 into v_value;

  return coalesce(p_prefix, upper(p_doc_type)) || '-' || lpad(v_value::text, 5, '0');
end;
$$;

-- ============================================================================
-- SECTION 6 — Sales: invoices, invoice_items, payments
-- ============================================================================

create table billing.invoices (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references billing.organizations(id) on delete cascade,
  customer_id    uuid not null references billing.customers(id) on delete restrict,
  warehouse_id   uuid references billing.warehouses(id),  -- required once a tracked item is on the invoice
  offer_id       uuid references billing.offers(id) on delete set null,
  invoice_number text,
  status         text not null default 'draft'
                   check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void')),
  currency       text not null default 'INR',
  issue_date     date not null default current_date,
  due_date       date,
  notes          text,
  subtotal       numeric(14, 2) not null default 0,
  tax_total      numeric(14, 2) not null default 0,
  discount_total numeric(14, 2) not null default 0,
  total          numeric(14, 2) not null default 0,
  amount_paid    numeric(14, 2) not null default 0,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (org_id, invoice_number)
);

create index invoices_org_id_idx on billing.invoices (org_id);
create index invoices_customer_id_idx on billing.invoices (customer_id);
create index invoices_status_idx on billing.invoices (org_id, status);

create table billing.invoice_items (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references billing.invoices(id) on delete cascade,
  item_id       uuid references billing.items(id) on delete set null,
  description   text not null,
  quantity      numeric(14, 4) not null default 1 check (quantity > 0),
  unit_price    numeric(14, 2) not null default 0,
  tax_rate      numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  line_subtotal numeric(14, 2) not null default 0,
  line_tax      numeric(14, 2) not null default 0,
  line_total    numeric(14, 2) not null default 0,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index invoice_items_invoice_id_idx on billing.invoice_items (invoice_id);

create table billing.payments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references billing.organizations(id) on delete cascade,
  invoice_id uuid not null references billing.invoices(id) on delete cascade,
  amount     numeric(14, 2) not null check (amount > 0),
  method     text not null default 'manual'
               check (method in ('manual', 'bank_transfer', 'cash', 'upi', 'razorpay')),
  reference  text,
  notes      text,
  paid_at    timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index payments_org_id_idx on billing.payments (org_id);
create index payments_invoice_id_idx on billing.payments (invoice_id);

-- ============================================================================
-- SECTION 7 — Sales returns: credit notes
-- ============================================================================

create table billing.credit_notes (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references billing.organizations(id) on delete cascade,
  invoice_id        uuid not null references billing.invoices(id) on delete restrict,
  customer_id       uuid not null references billing.customers(id) on delete restrict,
  warehouse_id      uuid references billing.warehouses(id),
  credit_note_number text,
  status            text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  issue_date        date not null default current_date,
  reason            text,
  subtotal          numeric(14, 2) not null default 0,
  tax_total         numeric(14, 2) not null default 0,
  total             numeric(14, 2) not null default 0,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, credit_note_number)
);

create index credit_notes_org_id_idx on billing.credit_notes (org_id);
create index credit_notes_invoice_id_idx on billing.credit_notes (invoice_id);

create table billing.credit_note_items (
  id             uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references billing.credit_notes(id) on delete cascade,
  invoice_item_id uuid references billing.invoice_items(id) on delete set null,
  item_id        uuid references billing.items(id) on delete set null,
  description    text not null,
  quantity       numeric(14, 4) not null default 1 check (quantity > 0),
  unit_price     numeric(14, 2) not null default 0,
  tax_rate       numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  line_subtotal  numeric(14, 2) not null default 0,
  line_tax       numeric(14, 2) not null default 0,
  line_total     numeric(14, 2) not null default 0,
  created_at     timestamptz not null default now()
);

create index credit_note_items_credit_note_id_idx on billing.credit_note_items (credit_note_id);

-- ============================================================================
-- SECTION 8 — Purchases: purchase_bills, purchase_bill_items, purchase_payments
-- ============================================================================

create table billing.purchase_bills (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references billing.organizations(id) on delete cascade,
  vendor_id             uuid not null references billing.vendors(id) on delete restrict,
  warehouse_id          uuid references billing.warehouses(id),  -- required once a tracked item is on the bill
  bill_number           text,       -- our internal number, assigned by trigger
  vendor_invoice_number text,       -- the supplier's own invoice/reference number
  status                text not null default 'draft'
                          check (status in ('draft', 'received', 'partially_paid', 'paid', 'void')),
  currency              text not null default 'INR',
  bill_date             date not null default current_date,
  due_date              date,
  notes                 text,
  subtotal              numeric(14, 2) not null default 0,
  tax_total              numeric(14, 2) not null default 0,
  total                 numeric(14, 2) not null default 0,
  amount_paid           numeric(14, 2) not null default 0,
  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (org_id, bill_number)
);

create index purchase_bills_org_id_idx on billing.purchase_bills (org_id);
create index purchase_bills_vendor_id_idx on billing.purchase_bills (vendor_id);
create index purchase_bills_status_idx on billing.purchase_bills (org_id, status);

create table billing.purchase_bill_items (
  id              uuid primary key default gen_random_uuid(),
  purchase_bill_id uuid not null references billing.purchase_bills(id) on delete cascade,
  item_id         uuid references billing.items(id) on delete set null,
  description     text not null,
  quantity        numeric(14, 4) not null default 1 check (quantity > 0),
  unit_cost       numeric(14, 2) not null default 0,
  tax_rate        numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  line_subtotal   numeric(14, 2) not null default 0,
  line_tax        numeric(14, 2) not null default 0,
  line_total      numeric(14, 2) not null default 0,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create index purchase_bill_items_bill_id_idx on billing.purchase_bill_items (purchase_bill_id);

create table billing.purchase_payments (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references billing.organizations(id) on delete cascade,
  purchase_bill_id uuid not null references billing.purchase_bills(id) on delete cascade,
  amount           numeric(14, 2) not null check (amount > 0),
  method           text not null default 'bank_transfer'
                     check (method in ('bank_transfer', 'cash', 'upi', 'cheque', 'other')),
  reference        text,
  notes            text,
  paid_at          timestamptz not null default now(),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

create index purchase_payments_org_id_idx on billing.purchase_payments (org_id);
create index purchase_payments_bill_id_idx on billing.purchase_payments (purchase_bill_id);

-- ============================================================================
-- SECTION 9 — Purchase returns: debit notes
-- ============================================================================

create table billing.debit_notes (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references billing.organizations(id) on delete cascade,
  purchase_bill_id  uuid not null references billing.purchase_bills(id) on delete restrict,
  vendor_id         uuid not null references billing.vendors(id) on delete restrict,
  warehouse_id      uuid references billing.warehouses(id),
  debit_note_number text,
  status            text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  issue_date        date not null default current_date,
  reason            text,
  subtotal          numeric(14, 2) not null default 0,
  tax_total         numeric(14, 2) not null default 0,
  total             numeric(14, 2) not null default 0,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, debit_note_number)
);

create index debit_notes_org_id_idx on billing.debit_notes (org_id);
create index debit_notes_bill_id_idx on billing.debit_notes (purchase_bill_id);

create table billing.debit_note_items (
  id                    uuid primary key default gen_random_uuid(),
  debit_note_id         uuid not null references billing.debit_notes(id) on delete cascade,
  purchase_bill_item_id uuid references billing.purchase_bill_items(id) on delete set null,
  item_id               uuid references billing.items(id) on delete set null,
  description           text not null,
  quantity              numeric(14, 4) not null default 1 check (quantity > 0),
  unit_cost             numeric(14, 2) not null default 0,
  tax_rate              numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  line_subtotal         numeric(14, 2) not null default 0,
  line_tax              numeric(14, 2) not null default 0,
  line_total            numeric(14, 2) not null default 0,
  created_at            timestamptz not null default now()
);

create index debit_note_items_debit_note_id_idx on billing.debit_note_items (debit_note_id);

-- ============================================================================
-- SECTION 10 — Add-on marketplace
-- ============================================================================

-- addons — the purchasable catalog. slug is what app code and RLS checks
-- key off (billing.org_has_addon(org_id, 'eway-bill')), not id, so it stays
-- readable in code and stable even if an addon is renamed.
create table billing.addons (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  description         text,
  price               numeric(10, 2) not null,  -- monthly
  min_commitment_days int not null default 30,
  is_active           boolean not null default true,  -- superadmin retires an addon from new purchases without touching existing subscribers
  created_at          timestamptz not null default now()
);

comment on table billing.addons is
  'Catalog of purchasable add-ons. Entitlement itself lives in organization_addon_subscriptions — this table is just the price list.';

-- organization_addon_subscriptions — the actual entitlement table. Writes
-- only ever happen through billing.subscribe_org_to_addon() /
-- billing.cancel_org_addon() (both in 003, both superadmin-gated inside the
-- function body) — there is no insert/update RLS policy on this table at
-- all for ordinary members, same shape as stock_movements: members can read
-- their org's row, but only a trusted, narrow path can write one.
create table billing.organization_addon_subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references billing.organizations(id) on delete cascade,
  addon_id             uuid not null references billing.addons(id) on delete restrict,
  status               text not null check (status in ('active', 'cancelled')),
  started_at           timestamptz not null default now(),
  min_commitment_until timestamptz not null,  -- started_at + addon.min_commitment_days at subscribe time. Informational for v1 — shown in the UI, not enforced by a state machine (no payment gateway wired up yet to reconcile against).
  cancelled_at         timestamptz,
  renews_at            timestamptz,  -- synced to the org's base-plan subscription_current_period_end — add-ons share the base plan's billing cycle, not an independent one
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table billing.organization_addon_subscriptions is
  'Entitlement table — one row per org+addon subscription attempt. Only one active row per (org_id, addon_id) at a time (see the partial unique index below); cancelled rows stay for history.';

create index organization_addon_subscriptions_org_id_idx on billing.organization_addon_subscriptions (org_id);
create unique index organization_addon_subscriptions_active_unique
  on billing.organization_addon_subscriptions (org_id, addon_id) where status = 'active';

-- business_type_addon_recommendations — purely advisory, shown at
-- onboarding ("as a pharmacy, you'll probably want batch/expiry tracking").
-- Never consulted for enforcement — org_has_addon() is the only thing that
-- gates a feature.
create table billing.business_type_addon_recommendations (
  business_type_id uuid not null references billing.business_types(id) on delete cascade,
  addon_id          uuid not null references billing.addons(id) on delete cascade,
  note              text,  -- short reason shown in the onboarding UI
  primary key (business_type_id, addon_id)
);
