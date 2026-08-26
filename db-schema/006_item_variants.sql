-- ============================================================================
-- nucleus-billing — 006: item variants (purchase-lot inventory + pricing)
--
-- Standalone patch, safe to run any time after 001-005 against a live
-- database. Additive only — never touches 001-004, follows 005's
-- convention. 004_grants.sql's `alter default privileges` already covers
-- every table created here automatically (grants all to
-- anon/authenticated/service_role on any future table in the schema) — no
-- grants file changes needed, same as 005 noted for itself.
--
-- What this adds: for a track_inventory = true item, pricing moves off the
-- item entirely and onto each purchase. A "variant" is one receiving event
-- — created by confirming a purchase bill line, carrying both what was
-- paid (unit_cost) and what it sells for (unit_price), always entered
-- together on the purchase form. Sales consume variants FIFO by default,
-- or from a specific variant the POS's price-chip UI explicitly chose
-- (invoice_items.item_variant_id) — falling back to FIFO for any shortfall
-- if that specific variant didn't have enough left. Voids and returns
-- restore/re-consume the *exact* variant(s) a sale actually drew from,
-- traced via new line-level columns on stock_movements.
--
-- track_inventory = false (service) items are entirely unaffected —
-- items.unit_price keeps working exactly as it does today; this patch adds
-- no constraint on that column and no code path touches it differently.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Selling price, entered alongside cost on the purchase bill form. Existing
-- rows default to 0 (backfill-free — no historical purchase had a selling
-- price to backfill from; the first purchase confirmed after this patch
-- ships is the first one required to fill it in for real).
-- ----------------------------------------------------------------------------
alter table billing.purchase_bill_items add column unit_price numeric(14, 2) not null default 0;

-- ----------------------------------------------------------------------------
-- item_variants — one row per receiving event. Always created by
-- confirming a purchase bill line (reference_type = 'purchase_bill_item'),
-- except the one synthetic case created by consume_variants_fifo() below
-- when a sale runs out of real variants to draw from (reference_type =
-- 'opening_balance') — overselling stays allowed, same policy
-- item_stock.quantity_on_hand already has today.
-- ----------------------------------------------------------------------------
create table billing.item_variants (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references billing.organizations(id) on delete cascade,
  item_id             uuid not null references billing.items(id) on delete restrict,
  warehouse_id        uuid not null references billing.warehouses(id) on delete restrict,
  unit_cost           numeric(14, 2) not null,
  unit_price          numeric(14, 2) not null,  -- always set at purchase time (or 0 for the opening_balance fallback) — never falls back to items.unit_price
  quantity_received   numeric(14, 4) not null check (quantity_received >= 0),  -- 0 only for the opening_balance fallback, which received nothing real
  quantity_remaining  numeric(14, 4) not null,  -- deliberately no >= 0 check: overselling stays allowed, same policy as item_stock today
  reference_type      text not null default 'purchase_bill_item' check (reference_type in ('purchase_bill_item', 'opening_balance')),
  reference_id        uuid,  -- purchase_bill_items.id when reference_type = 'purchase_bill_item'; null for opening_balance
  received_at         timestamptz not null default now(),
  created_by          uuid references auth.users(id) default auth.uid(),
  created_at          timestamptz not null default now()
);
create index item_variants_fifo_idx on billing.item_variants (item_id, warehouse_id, received_at);
-- Guarantees purchase-void / debit-note "exact restoration" always finds exactly one row.
create unique index item_variants_purchase_bill_item_idx on billing.item_variants (reference_id) where reference_type = 'purchase_bill_item';

comment on table billing.item_variants is
  'One row per purchase receiving event for a track_inventory item, carrying both cost and selling price. quantity_remaining is mutated only by the *_stock_effect() trigger functions below (security definer) — never directly by app code.';

-- ----------------------------------------------------------------------------
-- stock_movement_variants — records which variant(s) a given stock_movements
-- row drew from or restored, and how much, in FIFO/allocation order.
-- sort_order is explicit (not inferred from created_at) because Postgres
-- freezes now() for the whole transaction — every row inserted in one
-- trigger execution would otherwise get an identical timestamp.
-- ----------------------------------------------------------------------------
create table billing.stock_movement_variants (
  id                 uuid primary key default gen_random_uuid(),
  stock_movement_id  uuid not null references billing.stock_movements(id) on delete cascade,
  item_variant_id    uuid not null references billing.item_variants(id) on delete restrict,
  quantity           numeric(14, 4) not null check (quantity <> 0),
  sort_order         int not null default 0,
  created_at         timestamptz not null default now()
);
create index stock_movement_variants_movement_idx on billing.stock_movement_variants (stock_movement_id, sort_order);
create index stock_movement_variants_variant_idx on billing.stock_movement_variants (item_variant_id);

-- ----------------------------------------------------------------------------
-- Line-level traceability on stock_movements, additive — does not disturb
-- the existing reference_type/reference_id document-level pair that
-- inventory/movements/page.tsx's REFERENCE_ROUTE map already uses to link
-- back to the parent document. All four nullable: only the relevant one is
-- set per movement_type.
-- ----------------------------------------------------------------------------
alter table billing.stock_movements add column invoice_item_id uuid references billing.invoice_items(id) on delete set null;
alter table billing.stock_movements add column purchase_bill_item_id uuid references billing.purchase_bill_items(id) on delete set null;
alter table billing.stock_movements add column credit_note_item_id uuid references billing.credit_note_items(id) on delete set null;

-- ----------------------------------------------------------------------------
-- Records which specific variant the POS's price-chip UI directed a line to
-- draw from. Null means "no explicit choice" (e.g. a line added on the
-- plain Invoice detail page, not the POS) — the sale trigger falls back to
-- FIFO for those, unchanged from today's behavior in spirit.
-- ----------------------------------------------------------------------------
alter table billing.invoice_items add column item_variant_id uuid references billing.item_variants(id) on delete set null;

-- ----------------------------------------------------------------------------
-- RLS — item_variants carries its own org_id (like stock_movements), so its
-- policy is direct. stock_movement_variants is a child table with no
-- org_id of its own, joined through stock_movement_id — same shape as
-- credit_note_items/etc., so it gets its own small security definer lookup
-- function, matching item_org_id()'s existing pattern exactly.
--
-- Neither table gets an insert/update/delete policy for ordinary members:
-- all writes happen exclusively through the security definer trigger
-- functions below, same as item_stock today.
-- ----------------------------------------------------------------------------
alter table billing.item_variants enable row level security;
create policy item_variants_select on billing.item_variants for select using (billing.is_org_member(org_id));

create or replace function billing.stock_movement_org_id(p_stock_movement_id uuid)
returns uuid language sql stable security definer set search_path = billing, public as $$
  select org_id from billing.stock_movements where id = p_stock_movement_id;
$$;

alter table billing.stock_movement_variants enable row level security;
create policy stock_movement_variants_select on billing.stock_movement_variants for select
  using (billing.is_org_member(billing.stock_movement_org_id(stock_movement_id)));

-- ============================================================================
-- Helper functions, reused by the *_stock_effect() triggers below.
-- ============================================================================

-- Walks item_variants for (item_id, warehouse_id) oldest-received-first,
-- decrementing each until p_quantity is covered, recording one
-- stock_movement_variants allocation row per variant touched
-- (sort_order starting at p_starting_sort_order — lets a caller reserve
-- sort_order 0 for an explicit variant choice made before calling this for
-- the remainder). If variants run out entirely, creates a zero-cost
-- 'opening_balance' variant for the shortfall so every sale always has full
-- allocation coverage — no special-casing "no variant" in restoration logic
-- later. quantity_remaining going negative here is deliberate: overselling
-- stays allowed, same as item_stock.quantity_on_hand today.
create or replace function billing.consume_variants_fifo(
  p_item_id uuid,
  p_warehouse_id uuid,
  p_org_id uuid,
  p_quantity numeric,
  p_stock_movement_id uuid,
  p_starting_sort_order int default 0
)
returns void
language plpgsql
security definer
set search_path = billing, public
as $$
declare
  v_variant record;
  v_remaining numeric := p_quantity;
  v_consume numeric;
  v_sort_order int := p_starting_sort_order;
  v_opening_variant_id uuid;
begin
  if p_quantity <= 0 then
    return;
  end if;

  for v_variant in
    select id, quantity_remaining from billing.item_variants
    where item_id = p_item_id and warehouse_id = p_warehouse_id and quantity_remaining > 0
    order by received_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_consume := least(v_remaining, v_variant.quantity_remaining);
    update billing.item_variants set quantity_remaining = quantity_remaining - v_consume where id = v_variant.id;
    insert into billing.stock_movement_variants (stock_movement_id, item_variant_id, quantity, sort_order)
      values (p_stock_movement_id, v_variant.id, v_consume, v_sort_order);
    v_remaining := v_remaining - v_consume;
    v_sort_order := v_sort_order + 1;
  end loop;

  if v_remaining > 0 then
    insert into billing.item_variants
      (org_id, item_id, warehouse_id, unit_cost, unit_price, quantity_received, quantity_remaining, reference_type)
      values (p_org_id, p_item_id, p_warehouse_id, 0, 0, 0, -v_remaining, 'opening_balance')
      returning id into v_opening_variant_id;
    insert into billing.stock_movement_variants (stock_movement_id, item_variant_id, quantity, sort_order)
      values (p_stock_movement_id, v_opening_variant_id, v_remaining, v_sort_order);
  end if;
end;
$$;

-- Reads p_source_movement_id's stock_movement_variants allocations in
-- sort_order (first-consumed-first), skipping p_skip_quantity worth before
-- applying anything (so a second partial return against the same original
-- sale picks up where an earlier one left off, instead of re-crediting
-- allocations an earlier credit note already restored), then applies up to
-- p_quantity against each remaining allocation in turn — restoring
-- (p_direction = 1, quantity_remaining goes up) or re-consuming
-- (p_direction = -1, for voiding a return) — capping partial application at
-- whatever p_quantity has left. Mirrors matching rows against
-- p_new_movement_id for audit symmetry. If the source movement has zero
-- allocations (an invoice/purchase confirmed before this patch shipped, so
-- its movement never got line-level variant tracking), this is correctly a
-- silent no-op — item_stock's own reversal still happens via the plain
-- stock_movements insert the caller already made, through the existing,
-- untouched stock_movements_apply() trigger, which never looked at
-- variants in the first place.
create or replace function billing.restore_variants_exact(
  p_source_movement_id uuid,
  p_quantity numeric,
  p_new_movement_id uuid,
  p_direction numeric default 1,
  p_skip_quantity numeric default 0
)
returns void
language plpgsql
security definer
set search_path = billing, public
as $$
declare
  v_alloc record;
  v_skip_remaining numeric := p_skip_quantity;
  v_remaining numeric := p_quantity;
  v_skip_here numeric;
  v_apply numeric;
  v_next_sort int;
begin
  if p_source_movement_id is null or p_quantity <= 0 then
    return;
  end if;

  for v_alloc in
    select item_variant_id, quantity from billing.stock_movement_variants
    where stock_movement_id = p_source_movement_id
    order by sort_order asc
  loop
    exit when v_remaining <= 0;

    v_skip_here := least(v_skip_remaining, v_alloc.quantity);
    v_skip_remaining := v_skip_remaining - v_skip_here;
    if v_skip_here >= v_alloc.quantity then
      continue;  -- this whole allocation was already accounted for by an earlier partial return
    end if;

    v_apply := least(v_remaining, v_alloc.quantity - v_skip_here);

    update billing.item_variants
      set quantity_remaining = quantity_remaining + (p_direction * v_apply)
      where id = v_alloc.item_variant_id;

    select coalesce(max(sort_order), -1) + 1 into v_next_sort
      from billing.stock_movement_variants where stock_movement_id = p_new_movement_id;
    insert into billing.stock_movement_variants (stock_movement_id, item_variant_id, quantity, sort_order)
      values (p_new_movement_id, v_alloc.item_variant_id, p_direction * v_apply, v_next_sort);

    v_remaining := v_remaining - v_apply;
  end loop;
end;
$$;

-- ============================================================================
-- The four stock-effect triggers, extended. Names, signatures and
-- attachment points (created back in 002) are unchanged — only the bodies
-- grow, via create or replace function, matching how 002 already treats
-- every one of these as replaceable.
-- ============================================================================

create or replace function billing.purchase_bills_stock_effect()
returns trigger
language plpgsql
security definer
set search_path = billing, public
as $$
declare
  v_item record;
  v_movement_id uuid;
  v_variant_id uuid;
begin
  if old.status = 'draft' and new.status not in ('draft', 'void') then
    for v_item in
      select pbi.id, pbi.item_id, pbi.quantity, pbi.unit_cost, pbi.unit_price
      from billing.purchase_bill_items pbi
      join billing.items i on i.id = pbi.item_id
      where pbi.purchase_bill_id = new.id and i.track_inventory = true
    loop
      if new.warehouse_id is null then
        raise exception 'Purchase bill % has stock-tracked items but no warehouse_id set', new.id;
      end if;

      insert into billing.stock_movements
        (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, purchase_bill_item_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, v_item.quantity, 'purchase', 'purchase_bill', new.id, v_item.id)
        returning id into v_movement_id;

      insert into billing.item_variants
        (org_id, item_id, warehouse_id, unit_cost, unit_price, quantity_received, quantity_remaining, reference_type, reference_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, v_item.unit_cost, v_item.unit_price, v_item.quantity, v_item.quantity, 'purchase_bill_item', v_item.id)
        returning id into v_variant_id;

      insert into billing.stock_movement_variants (stock_movement_id, item_variant_id, quantity, sort_order)
        values (v_movement_id, v_variant_id, v_item.quantity, 0);
    end loop;
  elsif old.status not in ('draft', 'void') and new.status = 'void' then
    for v_item in
      select pbi.id, pbi.item_id, pbi.quantity
      from billing.purchase_bill_items pbi
      join billing.items i on i.id = pbi.item_id
      where pbi.purchase_bill_id = new.id and i.track_inventory = true
    loop
      insert into billing.stock_movements
        (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, purchase_bill_item_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, -v_item.quantity, 'purchase_void', 'purchase_bill', new.id, v_item.id)
        returning id into v_movement_id;

      select id into v_variant_id from billing.item_variants
        where reference_type = 'purchase_bill_item' and reference_id = v_item.id;

      if v_variant_id is not null then
        update billing.item_variants set quantity_remaining = quantity_remaining - v_item.quantity where id = v_variant_id;
        insert into billing.stock_movement_variants (stock_movement_id, item_variant_id, quantity, sort_order)
          values (v_movement_id, v_variant_id, -v_item.quantity, 0);
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create or replace function billing.invoices_stock_effect()
returns trigger
language plpgsql
security definer
set search_path = billing, public
as $$
declare
  v_item record;
  v_movement_id uuid;
  v_original_movement_id uuid;
  v_variant_remaining numeric;
  v_take numeric;
begin
  if old.status = 'draft' and new.status not in ('draft', 'void') then
    for v_item in
      select ii.id, ii.item_id, ii.quantity, ii.item_variant_id
      from billing.invoice_items ii
      join billing.items i on i.id = ii.item_id
      where ii.invoice_id = new.id and i.track_inventory = true
    loop
      if new.warehouse_id is null then
        raise exception 'Invoice % has stock-tracked items but no warehouse_id set', new.id;
      end if;

      insert into billing.stock_movements
        (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, invoice_item_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, -v_item.quantity, 'sale', 'invoice', new.id, v_item.id)
        returning id into v_movement_id;

      if v_item.item_variant_id is not null then
        select quantity_remaining into v_variant_remaining from billing.item_variants
          where id = v_item.item_variant_id for update;

        v_take := least(greatest(v_variant_remaining, 0), v_item.quantity);
        if v_take > 0 then
          update billing.item_variants set quantity_remaining = quantity_remaining - v_take where id = v_item.item_variant_id;
          insert into billing.stock_movement_variants (stock_movement_id, item_variant_id, quantity, sort_order)
            values (v_movement_id, v_item.item_variant_id, v_take, 0);
        end if;
        if v_item.quantity - v_take > 0 then
          perform billing.consume_variants_fifo(v_item.item_id, new.warehouse_id, new.org_id, v_item.quantity - v_take, v_movement_id, 1);
        end if;
      else
        perform billing.consume_variants_fifo(v_item.item_id, new.warehouse_id, new.org_id, v_item.quantity, v_movement_id, 0);
      end if;
    end loop;
  elsif old.status not in ('draft', 'void') and new.status = 'void' then
    for v_item in
      select ii.id, ii.item_id, ii.quantity
      from billing.invoice_items ii
      join billing.items i on i.id = ii.item_id
      where ii.invoice_id = new.id and i.track_inventory = true
    loop
      insert into billing.stock_movements
        (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, invoice_item_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, v_item.quantity, 'sale_void', 'invoice', new.id, v_item.id)
        returning id into v_movement_id;

      select id into v_original_movement_id from billing.stock_movements
        where invoice_item_id = v_item.id and movement_type = 'sale';

      perform billing.restore_variants_exact(v_original_movement_id, v_item.quantity, v_movement_id, 1);
    end loop;
  end if;
  return new;
end;
$$;

create or replace function billing.credit_notes_stock_effect()
returns trigger
language plpgsql
security definer
set search_path = billing, public
as $$
declare
  v_item record;
  v_movement_id uuid;
  v_original_movement_id uuid;
  v_already_returned numeric;
begin
  if old.status = 'draft' and new.status = 'issued' then
    for v_item in
      select cni.id, cni.item_id, cni.quantity, cni.invoice_item_id
      from billing.credit_note_items cni
      join billing.items i on i.id = cni.item_id
      where cni.credit_note_id = new.id and i.track_inventory = true
    loop
      if new.warehouse_id is null then
        raise exception 'Credit note % has stock-tracked items but no warehouse_id set', new.id;
      end if;

      insert into billing.stock_movements
        (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, invoice_item_id, credit_note_item_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, v_item.quantity, 'sales_return', 'credit_note', new.id, v_item.invoice_item_id, v_item.id)
        returning id into v_movement_id;

      if v_item.invoice_item_id is not null then
        select id into v_original_movement_id from billing.stock_movements
          where invoice_item_id = v_item.invoice_item_id and movement_type = 'sale';

        -- A second (or third...) partial return against the same original
        -- sale must pick up where the previous one left off, not replay the
        -- full original allocation from the start — excluding the row just
        -- inserted above by id, since it's already visible to this query
        -- within the same transaction.
        select coalesce(sum(sm.quantity_delta), 0) into v_already_returned
          from billing.stock_movements sm
          where sm.invoice_item_id = v_item.invoice_item_id
            and sm.movement_type = 'sales_return'
            and sm.id != v_movement_id;

        perform billing.restore_variants_exact(v_original_movement_id, v_item.quantity, v_movement_id, 1, v_already_returned);
      end if;
    end loop;
  elsif old.status = 'issued' and new.status = 'void' then
    for v_item in
      select cni.id, cni.item_id, cni.quantity, cni.invoice_item_id
      from billing.credit_note_items cni
      join billing.items i on i.id = cni.item_id
      where cni.credit_note_id = new.id and i.track_inventory = true
    loop
      insert into billing.stock_movements
        (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, invoice_item_id, credit_note_item_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, -v_item.quantity, 'sales_return_void', 'credit_note', new.id, v_item.invoice_item_id, v_item.id)
        returning id into v_movement_id;

      -- Reverse the return itself (not the original sale): find the
      -- sales_return movement *this credit note line* created, and
      -- re-consume the same variants it had restored.
      select id into v_original_movement_id from billing.stock_movements
        where credit_note_item_id = v_item.id and movement_type = 'sales_return';

      perform billing.restore_variants_exact(v_original_movement_id, v_item.quantity, v_movement_id, -1);
    end loop;
  end if;
  return new;
end;
$$;

create or replace function billing.debit_notes_stock_effect()
returns trigger
language plpgsql
security definer
set search_path = billing, public
as $$
declare
  v_item record;
  v_movement_id uuid;
  v_variant_id uuid;
begin
  if old.status = 'draft' and new.status = 'issued' then
    for v_item in
      select dni.id, dni.item_id, dni.quantity, dni.purchase_bill_item_id
      from billing.debit_note_items dni
      join billing.items i on i.id = dni.item_id
      where dni.debit_note_id = new.id and i.track_inventory = true
    loop
      if new.warehouse_id is null then
        raise exception 'Debit note % has stock-tracked items but no warehouse_id set', new.id;
      end if;

      insert into billing.stock_movements
        (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, purchase_bill_item_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, -v_item.quantity, 'purchase_return', 'debit_note', new.id, v_item.purchase_bill_item_id)
        returning id into v_movement_id;

      if v_item.purchase_bill_item_id is not null then
        select id into v_variant_id from billing.item_variants
          where reference_type = 'purchase_bill_item' and reference_id = v_item.purchase_bill_item_id;

        if v_variant_id is not null then
          update billing.item_variants set quantity_remaining = quantity_remaining - v_item.quantity where id = v_variant_id;
          insert into billing.stock_movement_variants (stock_movement_id, item_variant_id, quantity, sort_order)
            values (v_movement_id, v_variant_id, -v_item.quantity, 0);
        end if;
      end if;
    end loop;
  elsif old.status = 'issued' and new.status = 'void' then
    for v_item in
      select dni.id, dni.item_id, dni.quantity, dni.purchase_bill_item_id
      from billing.debit_note_items dni
      join billing.items i on i.id = dni.item_id
      where dni.debit_note_id = new.id and i.track_inventory = true
    loop
      insert into billing.stock_movements
        (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, purchase_bill_item_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, v_item.quantity, 'purchase_return_void', 'debit_note', new.id, v_item.purchase_bill_item_id)
        returning id into v_movement_id;

      if v_item.purchase_bill_item_id is not null then
        select id into v_variant_id from billing.item_variants
          where reference_type = 'purchase_bill_item' and reference_id = v_item.purchase_bill_item_id;

        if v_variant_id is not null then
          update billing.item_variants set quantity_remaining = quantity_remaining + v_item.quantity where id = v_variant_id;
          insert into billing.stock_movement_variants (stock_movement_id, item_variant_id, quantity, sort_order)
            values (v_movement_id, v_variant_id, v_item.quantity, 0);
        end if;
      end if;
    end loop;
  end if;
  return new;
end;
$$;
