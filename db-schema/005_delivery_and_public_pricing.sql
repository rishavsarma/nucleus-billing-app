-- ============================================================================
-- nucleus-billing — delivery system + public pricing calculator patch
-- Safe to run standalone against a database that already has v3 (001-004)
-- applied (your live setup) — new tables/columns/policies only, nothing
-- here touches existing data. Follows the same standalone-patch convention
-- v2's 005_superadmin.sql used.
--
-- What this adds:
--   1. Local delivery tracking — one delivery per invoice, a simple
--      per-org list of delivery people (not a login role), and a
--      payment-mode label (COD/prepaid) that's purely informational.
--      Core feature — not gated behind an add-on.
--   2. Public read access on the add-on/business-type catalogs, so an
--      anonymous visitor can see your pricing calculator before signing up
--      — previously these were readable by signed-in users only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Public pricing calculator — loosen catalog reads from
-- "any signed-in user" to "anyone, including anonymous visitors." This is
-- safe: these three tables hold non-sensitive, non-org-specific data
-- (add-on names/prices/descriptions, business type names, recommendation
-- notes) — nothing here is a customer's data. Write access is unchanged —
-- still superadmin-only.
-- ----------------------------------------------------------------------------
drop policy if exists business_types_select on billing.business_types;
create policy business_types_select on billing.business_types for select using (true);

drop policy if exists addons_select on billing.addons;
create policy addons_select on billing.addons for select using (true);

drop policy if exists business_type_addon_recommendations_select on billing.business_type_addon_recommendations;
create policy business_type_addon_recommendations_select on billing.business_type_addon_recommendations for select using (true);

-- ----------------------------------------------------------------------------
-- 2. Local delivery
-- ----------------------------------------------------------------------------

-- delivery_persons — a small per-org lookup, same pattern as warehouses.
-- Deliberately NOT tied to auth.users — this is a name in a dropdown, not
-- a login role. is_active lets someone who's left stop showing up in the
-- dropdown without losing their name off past deliveries (on delete set
-- null on deliveries.delivery_person_id below does the same for hard
-- removal).
create table billing.delivery_persons (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references billing.organizations(id) on delete cascade,
  name       text not null,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index delivery_persons_org_id_idx on billing.delivery_persons (org_id);

-- deliveries — one per invoice for now (a v1 simplification; loosen the
-- unique constraint below later if split/partial shipments are ever
-- needed). delivery_address is a point-in-time snapshot, not a live link
-- to the customer's saved address, so it doesn't silently change if the
-- customer's address is edited later. No status-transition guard trigger
-- here on purpose, unlike invoices/bills — this is an operational tracking
-- label, not a financial document, so a delivery can move freely between
-- statuses (including back to pending for a retry) without the same
-- guard rails money-bearing documents get.
create table billing.deliveries (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references billing.organizations(id) on delete cascade,
  invoice_id          uuid not null references billing.invoices(id) on delete restrict,
  delivery_address    jsonb,
  delivery_person_id  uuid references billing.delivery_persons(id) on delete set null,
  payment_mode        text check (payment_mode is null or payment_mode in ('cod', 'prepaid')),
  status              text not null default 'pending'
                         check (status in ('pending', 'out_for_delivery', 'delivered', 'failed')),
  delivered_at        timestamptz,
  notes               text,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (invoice_id)
);

create index deliveries_org_id_idx on billing.deliveries (org_id);
create index deliveries_delivery_person_id_idx on billing.deliveries (delivery_person_id);
create index deliveries_status_idx on billing.deliveries (org_id, status);

comment on table billing.deliveries is
  'One delivery per invoice. Lightweight operational tracking, not a financial document — no status-transition guard, unlike invoices/bills.';

create trigger deliveries_set_updated_at before update on billing.deliveries
  for each row execute function billing.set_updated_at();

-- RLS: ordinary org-scoped CRUD, same shape as customers/vendors/warehouses
-- — no special financial-document treatment (no delete restriction),
-- since neither table here is a financial record.
alter table billing.delivery_persons enable row level security;
create policy delivery_persons_select on billing.delivery_persons for select using (billing.is_org_member(org_id));
create policy delivery_persons_insert on billing.delivery_persons for insert with check (billing.is_org_member(org_id));
create policy delivery_persons_update on billing.delivery_persons for update using (billing.is_org_member(org_id));
create policy delivery_persons_delete on billing.delivery_persons for delete using (billing.is_org_member(org_id));

alter table billing.deliveries enable row level security;
create policy deliveries_select on billing.deliveries for select using (billing.is_org_member(org_id));
create policy deliveries_insert on billing.deliveries for insert with check (billing.is_org_member(org_id));
create policy deliveries_update on billing.deliveries for update using (billing.is_org_member(org_id));
create policy deliveries_delete on billing.deliveries for delete using (billing.is_org_member(org_id));

-- 004_grants.sql's `alter default privileges` already covers these two new
-- tables automatically (grants all to anon/authenticated/service_role on
-- any future table in the schema) — no grants file changes needed.
