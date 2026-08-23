-- ============================================================================
-- nucleus-billing — Row Level Security v2
-- Run after 001_billing_schema.sql and 002_functions_triggers.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers — SECURITY DEFINER + fixed search_path so these bypass RLS on the
-- tables they read internally (avoids recursive-policy issues).
-- ----------------------------------------------------------------------------

-- Platform superadmin check. Deliberately its own function (rather than
-- inlined) so every policy/trigger that needs it — org creation, the
-- is_active guard, and is_org_member/is_org_admin below — reads it the
-- same way.
create or replace function billing.is_superadmin()
returns boolean language sql stable security definer set search_path = billing, public as $$
  select exists (select 1 from billing.superadmins s where s.user_id = auth.uid());
$$;

-- A superadmin passes for EVERY org_id, unconditionally — this is what
-- gives them cross-tenant read access everywhere, since virtually every
-- table's RLS policy is ultimately gated through is_org_member/is_org_admin
-- (either directly, or via one of the *_org_id lookup helpers below).
-- For everyone else, membership only counts while the org is active — an
-- org a superadmin has deactivated stops being visible/writable to its own
-- members immediately, without touching any of the ~60 policies below.
create or replace function billing.is_org_member(p_org_id uuid)
returns boolean language sql stable security definer set search_path = billing, public as $$
  select billing.is_superadmin() or exists (
    select 1 from billing.memberships m
    join billing.organizations o on o.id = m.org_id
    where m.org_id = p_org_id and m.user_id = auth.uid() and o.is_active
  );
$$;

create or replace function billing.is_org_admin(p_org_id uuid)
returns boolean language sql stable security definer set search_path = billing, public as $$
  select billing.is_superadmin() or exists (
    select 1 from billing.memberships m
    join billing.organizations o on o.id = m.org_id
    where m.org_id = p_org_id and m.user_id = auth.uid()
      and m.role in ('owner', 'admin') and o.is_active
  );
$$;

create or replace function billing.invoice_org_id(p_invoice_id uuid)
returns uuid language sql stable security definer set search_path = billing, public as $$
  select org_id from billing.invoices where id = p_invoice_id;
$$;

create or replace function billing.credit_note_org_id(p_id uuid)
returns uuid language sql stable security definer set search_path = billing, public as $$
  select org_id from billing.credit_notes where id = p_id;
$$;

create or replace function billing.purchase_bill_org_id(p_id uuid)
returns uuid language sql stable security definer set search_path = billing, public as $$
  select org_id from billing.purchase_bills where id = p_id;
$$;

create or replace function billing.debit_note_org_id(p_id uuid)
returns uuid language sql stable security definer set search_path = billing, public as $$
  select org_id from billing.debit_notes where id = p_id;
$$;

create or replace function billing.offer_org_id(p_id uuid)
returns uuid language sql stable security definer set search_path = billing, public as $$
  select org_id from billing.offers where id = p_id;
$$;

create or replace function billing.item_org_id(p_item_id uuid)
returns uuid language sql stable security definer set search_path = billing, public as $$
  select org_id from billing.items where id = p_item_id;
$$;

-- ----------------------------------------------------------------------------
-- organizations / memberships / superadmins
-- ----------------------------------------------------------------------------
alter table billing.organizations enable row level security;
create policy organizations_select on billing.organizations for select using (billing.is_org_member(id));
-- Only a superadmin can create an organization at all — an ordinary user
-- has no path to insert one, including their own, via the API.
create policy organizations_insert on billing.organizations for insert with check (billing.is_superadmin());
-- Org owners/admins can still update their own org's settings (GST, PDF,
-- prefixes, etc.) while it's active — is_org_admin() already requires
-- is_active for them, so this closes itself the moment a superadmin
-- deactivates the org. Changing is_active itself is further restricted to
-- superadmins only by the organizations_active_change_guard trigger below,
-- regardless of what this policy allows.
create policy organizations_update on billing.organizations for update using (billing.is_org_admin(id));
-- No delete policy — organizations are never hard-deleted, only
-- deactivated (is_active = false), same reasoning as the financial
-- documents further down.

alter table billing.memberships enable row level security;
create policy memberships_select on billing.memberships for select using (billing.is_org_member(org_id));
create policy memberships_insert on billing.memberships for insert with check (billing.is_org_admin(org_id));
create policy memberships_update on billing.memberships for update using (billing.is_org_admin(org_id));
create policy memberships_delete on billing.memberships for delete using (billing.is_org_admin(org_id));

-- superadmins: readable by a superadmin (so the app can show "you're a
-- superadmin" / list co-superadmins); nobody can grant themselves this
-- through the API — no insert/update/delete policy exists here at all, on
-- purpose. Granting it is a manual `insert into billing.superadmins ...`
-- run directly against the database.
alter table billing.superadmins enable row level security;
create policy superadmins_select on billing.superadmins for select using (billing.is_superadmin());

-- ----------------------------------------------------------------------------
-- Parties
-- ----------------------------------------------------------------------------
alter table billing.customers enable row level security;
create policy customers_select on billing.customers for select using (billing.is_org_member(org_id));
create policy customers_insert on billing.customers for insert with check (billing.is_org_member(org_id));
create policy customers_update on billing.customers for update using (billing.is_org_member(org_id));
create policy customers_delete on billing.customers for delete using (billing.is_org_member(org_id));

alter table billing.vendors enable row level security;
create policy vendors_select on billing.vendors for select using (billing.is_org_member(org_id));
create policy vendors_insert on billing.vendors for insert with check (billing.is_org_member(org_id));
create policy vendors_update on billing.vendors for update using (billing.is_org_member(org_id));
create policy vendors_delete on billing.vendors for delete using (billing.is_org_member(org_id));

-- ----------------------------------------------------------------------------
-- Catalog & inventory
-- ----------------------------------------------------------------------------
alter table billing.tax_rates enable row level security;
create policy tax_rates_select on billing.tax_rates for select using (billing.is_org_member(org_id));
create policy tax_rates_insert on billing.tax_rates for insert with check (billing.is_org_member(org_id));
create policy tax_rates_update on billing.tax_rates for update using (billing.is_org_member(org_id));
create policy tax_rates_delete on billing.tax_rates for delete using (billing.is_org_member(org_id));

alter table billing.warehouses enable row level security;
create policy warehouses_select on billing.warehouses for select using (billing.is_org_member(org_id));
create policy warehouses_insert on billing.warehouses for insert with check (billing.is_org_member(org_id));
create policy warehouses_update on billing.warehouses for update using (billing.is_org_member(org_id));
create policy warehouses_delete on billing.warehouses for delete using (billing.is_org_member(org_id));

alter table billing.items enable row level security;
create policy items_select on billing.items for select using (billing.is_org_member(org_id));
create policy items_insert on billing.items for insert with check (billing.is_org_member(org_id));
create policy items_update on billing.items for update using (billing.is_org_member(org_id));
create policy items_delete on billing.items for delete using (billing.is_org_member(org_id));

-- item_stock: read-only from the API. All writes happen via the
-- stock_movements_apply() trigger (SECURITY DEFINER), never directly.
alter table billing.item_stock enable row level security;
create policy item_stock_select on billing.item_stock for select using (billing.is_org_member(billing.item_org_id(item_id)));

-- stock_movements: members can read their org's ledger. Direct inserts are
-- restricted to movement_type = 'adjustment' — 'sale'/'purchase'/
-- 'sales_return'/'purchase_return' (and their _void reversals) can only be
-- written by the SECURITY DEFINER stock-effect trigger functions in 002,
-- never by a client fabricating a row directly. Update/delete are blocked
-- at the RLS layer too, on top of the immutability trigger from 002.
alter table billing.stock_movements enable row level security;
create policy stock_movements_select on billing.stock_movements for select using (billing.is_org_member(org_id));
create policy stock_movements_insert on billing.stock_movements for insert
  with check (billing.is_org_member(org_id) and movement_type = 'adjustment');

-- ----------------------------------------------------------------------------
-- Offers
-- ----------------------------------------------------------------------------
alter table billing.offers enable row level security;
create policy offers_select on billing.offers for select using (billing.is_org_member(org_id));
create policy offers_insert on billing.offers for insert with check (billing.is_org_member(org_id));
create policy offers_update on billing.offers for update using (billing.is_org_member(org_id));
create policy offers_delete on billing.offers for delete using (billing.is_org_member(org_id));

alter table billing.offer_items enable row level security;
create policy offer_items_select on billing.offer_items for select using (billing.is_org_member(billing.offer_org_id(offer_id)));
create policy offer_items_insert on billing.offer_items for insert with check (billing.is_org_member(billing.offer_org_id(offer_id)));
create policy offer_items_delete on billing.offer_items for delete using (billing.is_org_member(billing.offer_org_id(offer_id)));

-- ----------------------------------------------------------------------------
-- Document counters — internal bookkeeping, read-only from the API
-- ----------------------------------------------------------------------------
alter table billing.org_document_counters enable row level security;
create policy org_document_counters_select on billing.org_document_counters for select using (billing.is_org_member(org_id));

-- ----------------------------------------------------------------------------
-- Sales: invoices, invoice_items, payments
-- ----------------------------------------------------------------------------
-- No delete policy: invoices are financial records — cancel via
-- status = 'void' (see 002's status-transition guard), never hard-deleted.
-- Same reasoning applies to payments, purchase_bills, purchase_payments,
-- credit_notes, and debit_notes below.
alter table billing.invoices enable row level security;
create policy invoices_select on billing.invoices for select using (billing.is_org_member(org_id));
create policy invoices_insert on billing.invoices for insert with check (billing.is_org_member(org_id));
create policy invoices_update on billing.invoices for update using (billing.is_org_member(org_id));

alter table billing.invoice_items enable row level security;
create policy invoice_items_select on billing.invoice_items for select using (billing.is_org_member(billing.invoice_org_id(invoice_id)));
create policy invoice_items_insert on billing.invoice_items for insert with check (billing.is_org_member(billing.invoice_org_id(invoice_id)));
create policy invoice_items_update on billing.invoice_items for update using (billing.is_org_member(billing.invoice_org_id(invoice_id)));
create policy invoice_items_delete on billing.invoice_items for delete using (billing.is_org_member(billing.invoice_org_id(invoice_id)));

alter table billing.payments enable row level security;
create policy payments_select on billing.payments for select using (billing.is_org_member(org_id));
create policy payments_insert on billing.payments for insert with check (billing.is_org_member(org_id));
create policy payments_update on billing.payments for update using (billing.is_org_member(org_id));

-- ----------------------------------------------------------------------------
-- Sales returns: credit notes
-- ----------------------------------------------------------------------------
alter table billing.credit_notes enable row level security;
create policy credit_notes_select on billing.credit_notes for select using (billing.is_org_member(org_id));
create policy credit_notes_insert on billing.credit_notes for insert with check (billing.is_org_member(org_id));
create policy credit_notes_update on billing.credit_notes for update using (billing.is_org_member(org_id));

alter table billing.credit_note_items enable row level security;
create policy credit_note_items_select on billing.credit_note_items for select using (billing.is_org_member(billing.credit_note_org_id(credit_note_id)));
create policy credit_note_items_insert on billing.credit_note_items for insert with check (billing.is_org_member(billing.credit_note_org_id(credit_note_id)));
create policy credit_note_items_update on billing.credit_note_items for update using (billing.is_org_member(billing.credit_note_org_id(credit_note_id)));
create policy credit_note_items_delete on billing.credit_note_items for delete using (billing.is_org_member(billing.credit_note_org_id(credit_note_id)));

-- ----------------------------------------------------------------------------
-- Purchases: purchase_bills, purchase_bill_items, purchase_payments
-- ----------------------------------------------------------------------------
alter table billing.purchase_bills enable row level security;
create policy purchase_bills_select on billing.purchase_bills for select using (billing.is_org_member(org_id));
create policy purchase_bills_insert on billing.purchase_bills for insert with check (billing.is_org_member(org_id));
create policy purchase_bills_update on billing.purchase_bills for update using (billing.is_org_member(org_id));

alter table billing.purchase_bill_items enable row level security;
create policy purchase_bill_items_select on billing.purchase_bill_items for select using (billing.is_org_member(billing.purchase_bill_org_id(purchase_bill_id)));
create policy purchase_bill_items_insert on billing.purchase_bill_items for insert with check (billing.is_org_member(billing.purchase_bill_org_id(purchase_bill_id)));
create policy purchase_bill_items_update on billing.purchase_bill_items for update using (billing.is_org_member(billing.purchase_bill_org_id(purchase_bill_id)));
create policy purchase_bill_items_delete on billing.purchase_bill_items for delete using (billing.is_org_member(billing.purchase_bill_org_id(purchase_bill_id)));

alter table billing.purchase_payments enable row level security;
create policy purchase_payments_select on billing.purchase_payments for select using (billing.is_org_member(org_id));
create policy purchase_payments_insert on billing.purchase_payments for insert with check (billing.is_org_member(org_id));
create policy purchase_payments_update on billing.purchase_payments for update using (billing.is_org_member(org_id));

-- ----------------------------------------------------------------------------
-- Purchase returns: debit notes
-- ----------------------------------------------------------------------------
alter table billing.debit_notes enable row level security;
create policy debit_notes_select on billing.debit_notes for select using (billing.is_org_member(org_id));
create policy debit_notes_insert on billing.debit_notes for insert with check (billing.is_org_member(org_id));
create policy debit_notes_update on billing.debit_notes for update using (billing.is_org_member(org_id));

alter table billing.debit_note_items enable row level security;
create policy debit_note_items_select on billing.debit_note_items for select using (billing.is_org_member(billing.debit_note_org_id(debit_note_id)));
create policy debit_note_items_insert on billing.debit_note_items for insert with check (billing.is_org_member(billing.debit_note_org_id(debit_note_id)));
create policy debit_note_items_update on billing.debit_note_items for update using (billing.is_org_member(billing.debit_note_org_id(debit_note_id)));
create policy debit_note_items_delete on billing.debit_note_items for delete using (billing.is_org_member(billing.debit_note_org_id(debit_note_id)));
