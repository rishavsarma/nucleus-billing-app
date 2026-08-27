-- ============================================================================
-- nucleus-billing — EMI / installment plans patch
-- Safe to run standalone against a database that already has 001-007
-- applied — new tables + one new column on billing.payments, nothing here
-- touches existing data.
--
-- Sales-only (attaches to invoices, not purchase bills) — per the design
-- question the audit raised: a generic version (nullable FK to either
-- invoices or purchase_bills, with a check constraint requiring exactly
-- one) is the idiomatic Postgres way to leave the door open, but real
-- added complexity for a side nobody's asked for yet. Rebuilding this into
-- the generic shape later is a straightforward migration, not a rewrite,
-- since this table is new and small — low cost to defer.
-- ============================================================================

-- installment_plans — one per invoice (v1 simplification, same shape as
-- deliveries' one-per-invoice choice in 005). total_amount is a snapshot of
-- invoices.total at plan creation time, not a live reference — invoices
-- lock their totals once they leave draft anyway (line items become
-- read-only per CLAUDE.md's financial-document rules), so this never
-- drifts from what was actually financed.
create table billing.installment_plans (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references billing.organizations(id) on delete cascade,
  invoice_id   uuid not null references billing.invoices(id) on delete cascade,
  total_amount numeric(14, 2) not null check (total_amount > 0),
  months       int not null check (months > 0),
  start_date   date not null,
  status       text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  unique (invoice_id)
);

create index installment_plans_org_id_idx on billing.installment_plans (org_id);

comment on table billing.installment_plans is
  'One EMI plan per invoice (v1, sales-only). See this file''s header comment for the purchase-bill deferral rationale.';

-- installments — one row per due date. installment_number is 1-indexed so
-- "installment 3 of 6" reads naturally in the UI with no off-by-one.
-- Amounts are computed app-side at plan-creation time (total_amount split
-- evenly across months, remainder absorbed by the last installment) — not
-- DB-enforced to sum back to the plan's total_amount, same trust-the-app-
-- layer approach the rest of this schema takes for derived values that
-- aren't security-sensitive.
create table billing.installments (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references billing.organizations(id) on delete cascade,
  plan_id            uuid not null references billing.installment_plans(id) on delete cascade,
  -- Denormalized from installment_plans.invoice_id (same value, set once at
  -- creation) purely so the Installments list page can link back to the
  -- invoice without a second lookup — same convenience-denormalization
  -- stock_movements already uses for invoice_item_id/purchase_bill_item_id.
  invoice_id         uuid not null references billing.invoices(id) on delete cascade,
  installment_number int not null check (installment_number > 0),
  due_date           date not null,
  amount             numeric(14, 2) not null check (amount > 0),
  -- "overdue" is deliberately not a stored value here — it's derived at
  -- read time (pending AND due_date < current_date) instead of flipped by
  -- a scheduled job. A stored 'overdue' needs something to flip it back
  -- (pg_cron isn't guaranteed available on every Postgres host this app
  -- might run on) and risks going stale the moment that job doesn't run;
  -- a computed value can never be stale.
  status             text not null default 'pending' check (status in ('pending', 'paid')),
  payment_id         uuid references billing.payments(id) on delete set null,
  paid_at            timestamptz,
  created_at         timestamptz not null default now(),
  unique (plan_id, installment_number)
);

create index installments_org_id_idx on billing.installments (org_id);
create index installments_plan_id_idx on billing.installments (plan_id);
create index installments_invoice_id_idx on billing.installments (invoice_id);
-- Powers "every installment due across the org" — the calendar view the
-- audit's own description of this feature calls for.
create index installments_due_date_idx on billing.installments (org_id, status, due_date);

comment on table billing.installments is
  'One row per due date within an installment_plans row. status only ever stores pending/paid — overdue is computed at read time, never stored.';

-- Links a payment to the specific installment it settles — nullable, since
-- most payments aren't against an EMI plan at all. Explicit, cashier-chosen
-- link (same pattern as invoice_items.item_variant_id from 006) rather than
-- auto-allocating an arbitrary payment amount across installments, which
-- gets ambiguous fast once a payment doesn't exactly match one installment.
alter table billing.payments add column installment_id uuid references billing.installments(id) on delete set null;
create index payments_installment_id_idx on billing.payments (installment_id);

-- Marks the linked installment paid the moment a payment references it.
-- Payments are never updated or deleted once created (see CLAUDE.md's
-- financial-document rules — payments is one of the six no-delete tables),
-- so this only ever needs to run on insert.
create or replace function billing.installments_mark_paid()
returns trigger
language plpgsql
security definer
set search_path = billing, public
as $$
begin
  update billing.installments
    set status = 'paid', payment_id = new.id, paid_at = new.paid_at
    where id = new.installment_id;
  return new;
end;
$$;
create trigger payments_mark_installment_paid after insert on billing.payments
  for each row when (new.installment_id is not null)
  execute function billing.installments_mark_paid();

-- Once every installment on a plan is paid, mark the plan completed —
-- purely informational (nothing gates on it), so an installments list can
-- stop showing a plan as "active" once it's actually done.
create or replace function billing.check_installment_plan_completed()
returns trigger
language plpgsql
security definer
set search_path = billing, public
as $$
declare v_remaining int;
begin
  select count(*) into v_remaining from billing.installments
    where plan_id = new.plan_id and status <> 'paid';
  if v_remaining = 0 then
    update billing.installment_plans set status = 'completed'
      where id = new.plan_id and status = 'active';
  end if;
  return new;
end;
$$;
create trigger installments_check_plan_completed after update of status on billing.installments
  for each row when (new.status = 'paid')
  execute function billing.check_installment_plan_completed();

-- RLS: same ordinary org-scoped CRUD shape as payments/invoices — every
-- org member can read/create/update, same as the rest of the billing flow.
-- No delete policy on either table, matching every other money-adjacent
-- table in this schema; cancellation is a status update, not a delete.
alter table billing.installment_plans enable row level security;
create policy installment_plans_select on billing.installment_plans for select using (billing.is_org_member(org_id));
create policy installment_plans_insert on billing.installment_plans for insert with check (billing.is_org_member(org_id));
create policy installment_plans_update on billing.installment_plans for update using (billing.is_org_member(org_id));

alter table billing.installments enable row level security;
create policy installments_select on billing.installments for select using (billing.is_org_member(org_id));
create policy installments_insert on billing.installments for insert with check (billing.is_org_member(org_id));
create policy installments_update on billing.installments for update using (billing.is_org_member(org_id));

-- 004_grants.sql's `alter default privileges` already covers new tables in
-- this schema automatically — no grants file changes needed.
