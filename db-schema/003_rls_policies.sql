-- ============================================================================
-- nucleus-billing — Row Level Security v3
-- Run after 001_billing_schema.sql and 002_functions_triggers.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers — SECURITY DEFINER + fixed search_path so these bypass RLS on the
-- tables they read internally (avoids recursive-policy issues).
-- ----------------------------------------------------------------------------

-- Platform superadmin check. Deliberately its own function (rather than
-- inlined) so every policy/trigger that needs it — org creation, the
-- is_active/subscription_status guards, is_org_member/is_org_admin,
-- org_has_addon, and the two addon subscribe/cancel functions below —
-- reads it the same way.
create or replace function billing.is_superadmin()
returns boolean language sql stable security definer set search_path = billing, public as $$
  select exists (select 1 from billing.superadmins s where s.user_id = auth.uid());
$$;

-- A superadmin passes for EVERY org_id, unconditionally — this is what
-- gives them cross-tenant read access everywhere, since virtually every
-- table's RLS policy is ultimately gated through is_org_member/is_org_admin
-- (either directly, or via one of the *_org_id lookup helpers below).
--
-- For everyone else, membership only counts while BOTH of two independent
-- conditions hold: the org hasn't been suspended by a superadmin
-- (is_active), and the org's base-plan subscription is actually usable
-- (subscription_status in 'trialing'/'active' — 'past_due' and 'cancelled'
-- do not pass). Folding the subscription check in here, right alongside
-- is_active, means every one of the ~55+ RLS policies below that already
-- depend on is_org_member/is_org_admin automatically enforces "org must
-- have a working base subscription" too — nothing else in this file, or in
-- 002, needed to change for that.
create or replace function billing.is_org_member(p_org_id uuid)
returns boolean language sql stable security definer set search_path = billing, public as $$
  select billing.is_superadmin() or exists (
    select 1 from billing.memberships m
    join billing.organizations o on o.id = m.org_id
    where m.org_id = p_org_id and m.user_id = auth.uid()
      and o.is_active
      and o.subscription_status in ('trialing', 'active')
  );
$$;

create or replace function billing.is_org_admin(p_org_id uuid)
returns boolean language sql stable security definer set search_path = billing, public as $$
  select billing.is_superadmin() or exists (
    select 1 from billing.memberships m
    join billing.organizations o on o.id = m.org_id
    where m.org_id = p_org_id and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
      and o.is_active
      and o.subscription_status in ('trialing', 'active')
  );
$$;

-- The add-on equivalent of is_org_member — checks a narrower thing (this
-- org has this ONE add-on active) rather than "is this person in the org
-- at all." A superadmin bypasses this too, same as the other two, so
-- support/ops can see gated features without the org needing to actually
-- hold the entitlement. Every future add-on-gated feature (a future
-- eway_bills table, for example) should combine this with is_org_member,
-- e.g.: using (billing.is_org_member(org_id) and billing.org_has_addon(org_id, 'eway-bill'))
create or replace function billing.org_has_addon(p_org_id uuid, p_addon_slug text)
returns boolean language sql stable security definer set search_path = billing, public as $$
  select billing.is_superadmin() or exists (
    select 1 from billing.organization_addon_subscriptions oas
    join billing.addons a on a.id = oas.addon_id
    where oas.org_id = p_org_id and a.slug = p_addon_slug and oas.status = 'active'
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
-- prefixes, business_type_id, etc.) while it's active and subscribed —
-- is_org_admin() already requires both for them, so this closes itself the
-- moment a superadmin deactivates the org or the base subscription lapses.
-- Changing is_active or subscription_status themselves is further
-- restricted to superadmins only by the two guard triggers in 002,
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

-- ----------------------------------------------------------------------------
-- Add-on marketplace
-- ----------------------------------------------------------------------------

-- business_types / addons / business_type_addon_recommendations: global
-- catalogs, not org-scoped. Readable by any signed-in user (so the app can
-- show the onboarding picker and the add-on marketplace to anyone), write
-- restricted to superadmin only.
alter table billing.business_types enable row level security;
create policy business_types_select on billing.business_types for select using (auth.uid() is not null);
create policy business_types_insert on billing.business_types for insert with check (billing.is_superadmin());
create policy business_types_update on billing.business_types for update using (billing.is_superadmin());
create policy business_types_delete on billing.business_types for delete using (billing.is_superadmin());

alter table billing.addons enable row level security;
create policy addons_select on billing.addons for select using (auth.uid() is not null);
create policy addons_insert on billing.addons for insert with check (billing.is_superadmin());
create policy addons_update on billing.addons for update using (billing.is_superadmin());
create policy addons_delete on billing.addons for delete using (billing.is_superadmin());

alter table billing.business_type_addon_recommendations enable row level security;
create policy business_type_addon_recommendations_select on billing.business_type_addon_recommendations for select using (auth.uid() is not null);
create policy business_type_addon_recommendations_insert on billing.business_type_addon_recommendations for insert with check (billing.is_superadmin());
create policy business_type_addon_recommendations_update on billing.business_type_addon_recommendations for update using (billing.is_superadmin());
create policy business_type_addon_recommendations_delete on billing.business_type_addon_recommendations for delete using (billing.is_superadmin());

-- organization_addon_subscriptions: org members can read what's active for
-- their own org (so the UI can show it). Deliberately NO insert/update/
-- delete policy for ordinary members at all — the only way a row here gets
-- written is through the two SECURITY DEFINER functions below, which are
-- superadmin-gated inside their own function body (not by RLS/grants,
-- which stay broad — same pattern the stock-effect functions in 002 use to
-- write restricted stock_movements rows).
alter table billing.organization_addon_subscriptions enable row level security;
create policy organization_addon_subscriptions_select on billing.organization_addon_subscriptions for select using (billing.is_org_member(org_id));

-- Subscribe an org to an add-on. Superadmin/service_role only for now — an
-- org can never grant itself a paid entitlement by calling this directly.
-- Once real payment collection exists, a webhook (as service_role) calls
-- this instead of a human; nothing else about the function needs to change.
create or replace function billing.subscribe_org_to_addon(p_org_id uuid, p_addon_slug text)
returns uuid
language plpgsql
security definer
set search_path = billing, public
as $$
declare
  v_addon      billing.addons%rowtype;
  v_existing   uuid;
  v_period_end timestamptz;
  v_new_id     uuid;
begin
  if not billing.is_superadmin() then
    raise exception 'Only a superadmin can subscribe an organization to an add-on';
  end if;

  select * into v_addon from billing.addons where slug = p_addon_slug and is_active;
  if v_addon.id is null then
    raise exception 'Add-on % does not exist or is not currently purchasable', p_addon_slug;
  end if;

  select id into v_existing from billing.organization_addon_subscriptions
    where org_id = p_org_id and addon_id = v_addon.id and status = 'active';
  if v_existing is not null then
    raise exception 'Organization % already has an active subscription to %', p_org_id, p_addon_slug;
  end if;

  select subscription_current_period_end into v_period_end
    from billing.organizations where id = p_org_id;

  insert into billing.organization_addon_subscriptions
    (org_id, addon_id, status, min_commitment_until, renews_at)
  values
    (p_org_id, v_addon.id, 'active', now() + (v_addon.min_commitment_days || ' days')::interval, v_period_end)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- Cancel an org's active subscription to an add-on. Same superadmin-only
-- gate as above. min_commitment_until is informational only in this
-- version (see 001's comment on the table) — cancelling before that date
-- is allowed here; enforcing/blocking it is a product decision to make
-- once real billing exists, not something this function decides silently.
create or replace function billing.cancel_org_addon(p_org_id uuid, p_addon_slug text)
returns void
language plpgsql
security definer
set search_path = billing, public
as $$
declare
  v_addon_id uuid;
begin
  if not billing.is_superadmin() then
    raise exception 'Only a superadmin can cancel an organization''s add-on subscription';
  end if;

  select id into v_addon_id from billing.addons where slug = p_addon_slug;
  if v_addon_id is null then
    raise exception 'Add-on % does not exist', p_addon_slug;
  end if;

  update billing.organization_addon_subscriptions
    set status = 'cancelled', cancelled_at = now()
    where org_id = p_org_id and addon_id = v_addon_id and status = 'active';

  if not found then
    raise exception 'Organization % has no active subscription to %', p_org_id, p_addon_slug;
  end if;
end;
$$;
