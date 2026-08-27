-- ============================================================================
-- nucleus-billing — sale/purchase return split patch
--
-- Today, "return goods" and "issue a credit/debit note" are forced to be
-- the same action: credit_notes/debit_notes always require a real
-- quantity tied to a real invoice/purchase-bill line, and always restock
-- inventory on issue. There's no way to adjust what a customer or vendor
-- owes for a reason that isn't a physical return (a price correction, a
-- goodwill discount, a shortage claim) — and it's a GST filing distinction
-- too, not just a UX one (a real return is reported differently, CDNR,
-- than a standalone value adjustment).
--
-- This patch is a RENAME, not a rewrite: credit_notes/debit_notes have
-- always actually been "physical return with restocking" documents, so
-- they become sales_returns/purchase_returns in place — every row, every
-- index, every constraint, and (critically) the item-variant-aware
-- restoration logic from 006 all move wholesale, byte-identical in
-- behavior, just renamed. Only the identifiers inside the trigger function
-- BODIES need rewriting (Postgres doesn't rewrite SQL text on a table
-- rename) — the underlying logic is untouched.
--
-- credit_notes/debit_notes are then recreated fresh, slim, and genuinely
-- new: no item_id/quantity/warehouse_id, no inventory trigger at all —
-- pure value-adjustment documents (description + amount + tax per line),
-- reusing the organizations.credit_note_prefix/debit_note_prefix columns
-- and 'credit_note'/'debit_note' numbering sequences that already exist,
-- since a "credit note" as a value adjustment (not necessarily tied to
-- physical goods) is the standard accounting meaning of the term anyway.
--
-- Data note: safe to run because this app is pre-launch with test data
-- only (per the MVP scoping conversation) — a rename this invasive would
-- need a very different, additive-only approach once real financial
-- history exists.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rename the existing tables + columns in place.
-- ----------------------------------------------------------------------------
alter table billing.credit_notes rename to sales_returns;
alter table billing.sales_returns rename column credit_note_number to sales_return_number;
alter table billing.sales_returns rename constraint credit_notes_org_id_credit_note_number_key to sales_returns_org_id_sales_return_number_key;
alter index billing.credit_notes_org_id_idx rename to sales_returns_org_id_idx;
alter index billing.credit_notes_invoice_id_idx rename to sales_returns_invoice_id_idx;

alter table billing.credit_note_items rename to sales_return_items;
alter table billing.sales_return_items rename column credit_note_id to sales_return_id;
alter index billing.credit_note_items_credit_note_id_idx rename to sales_return_items_sales_return_id_idx;

alter table billing.debit_notes rename to purchase_returns;
alter table billing.purchase_returns rename column debit_note_number to purchase_return_number;
alter table billing.purchase_returns rename constraint debit_notes_org_id_debit_note_number_key to purchase_returns_org_id_purchase_return_number_key;
alter index billing.debit_notes_org_id_idx rename to purchase_returns_org_id_idx;
alter index billing.debit_notes_bill_id_idx rename to purchase_returns_bill_id_idx;

alter table billing.debit_note_items rename to purchase_return_items;
alter table billing.purchase_return_items rename column debit_note_id to purchase_return_id;
alter index billing.debit_note_items_debit_note_id_idx rename to purchase_return_items_purchase_return_id_idx;

alter table billing.stock_movements rename column credit_note_item_id to sales_return_item_id;

-- Existing stock_movements rows keep their old reference_type values
-- ('credit_note'/'debit_note') forever — stock_movements is append-only,
-- enforced by a trigger against every role including service_role
-- (db-schema/CLAUDE.md §3), so there is no permitted way to relabel them
-- in place, and there shouldn't be: a correction to history is a new
-- offsetting row, never an edit of an old one. The app layer is written
-- to treat 'credit_note'/'debit_note' as permanent legacy aliases for
-- 'sales_return'/'purchase_return' wherever reference_type is read
-- (see app/[locale]/(app)/inventory/movements/page.tsx's REFERENCE_ROUTE
-- map and the ReferenceTypes i18n namespace) rather than assuming a
-- one-time backfill will ever run.

-- ----------------------------------------------------------------------------
-- 2. New prefix columns for the renamed (physical-return) documents —
-- credit_note_prefix/debit_note_prefix stay put, now belonging to the new
-- slim tables created in section 6.
-- ----------------------------------------------------------------------------
alter table billing.organizations add column sales_return_prefix text not null default 'SR';
alter table billing.organizations add column purchase_return_prefix text not null default 'PR';

-- ----------------------------------------------------------------------------
-- 3. org_document_counters gets two new doc_type values for the renamed
-- tables' numbering — fresh counters, not continuing the old
-- 'credit_note'/'debit_note' sequence (this app has no real documents
-- issued yet, so there's nothing to stay continuous with).
-- ----------------------------------------------------------------------------
alter table billing.org_document_counters drop constraint org_document_counters_doc_type_check;
alter table billing.org_document_counters add constraint org_document_counters_doc_type_check
  check (doc_type in ('invoice', 'purchase_bill', 'credit_note', 'debit_note', 'sales_return', 'purchase_return'));

-- ----------------------------------------------------------------------------
-- 4. Numbering triggers for the renamed tables.
-- ----------------------------------------------------------------------------
create or replace function billing.assign_sales_return_number()
returns trigger language plpgsql set search_path = billing, public as $$
declare v_prefix text;
begin
  if new.sales_return_number is null then
    select sales_return_prefix into v_prefix from billing.organizations where id = new.org_id;
    new.sales_return_number := billing.next_document_number(new.org_id, 'sales_return', v_prefix);
  end if;
  return new;
end;
$$;
drop trigger if exists credit_notes_assign_number on billing.sales_returns;
create trigger sales_returns_assign_number before insert on billing.sales_returns
  for each row execute function billing.assign_sales_return_number();

create or replace function billing.assign_purchase_return_number()
returns trigger language plpgsql set search_path = billing, public as $$
declare v_prefix text;
begin
  if new.purchase_return_number is null then
    select purchase_return_prefix into v_prefix from billing.organizations where id = new.org_id;
    new.purchase_return_number := billing.next_document_number(new.org_id, 'purchase_return', v_prefix);
  end if;
  return new;
end;
$$;
drop trigger if exists debit_notes_assign_number on billing.purchase_returns;
create trigger purchase_returns_assign_number before insert on billing.purchase_returns
  for each row execute function billing.assign_purchase_return_number();

-- billing.assign_credit_note_number()/assign_debit_note_number() are
-- redefined in section 6 below to serve the new slim tables instead.

-- ----------------------------------------------------------------------------
-- 5. Recalc + line-total triggers for the renamed tables. The generic
-- compute_line_totals_price() trigger from 002 stays attached automatically
-- (triggers are owned by the table, not the name) — only the recalc
-- function's own SQL text (which references the old table/column names
-- literally) needs rewriting.
-- ----------------------------------------------------------------------------
create or replace function billing.recalc_sales_return(p_id uuid)
returns void language plpgsql set search_path = billing, public as $$
declare v_subtotal numeric(14,2); v_tax numeric(14,2);
begin
  perform 1 from billing.sales_returns where id = p_id for update;
  select coalesce(sum(line_subtotal), 0), coalesce(sum(line_tax), 0)
    into v_subtotal, v_tax
    from billing.sales_return_items where sales_return_id = p_id;
  update billing.sales_returns
    set subtotal = v_subtotal, tax_total = v_tax, total = v_subtotal + v_tax
    where id = p_id;
end;
$$;
create or replace function billing.sales_return_items_recalc_trigger()
returns trigger language plpgsql set search_path = billing, public as $$
begin perform billing.recalc_sales_return(coalesce(new.sales_return_id, old.sales_return_id)); return coalesce(new, old); end;
$$;
drop trigger if exists credit_note_items_after_change on billing.sales_return_items;
create trigger sales_return_items_after_change after insert or update or delete on billing.sales_return_items
  for each row execute function billing.sales_return_items_recalc_trigger();

create or replace function billing.recalc_purchase_return(p_id uuid)
returns void language plpgsql set search_path = billing, public as $$
declare v_subtotal numeric(14,2); v_tax numeric(14,2);
begin
  perform 1 from billing.purchase_returns where id = p_id for update;
  select coalesce(sum(line_subtotal), 0), coalesce(sum(line_tax), 0)
    into v_subtotal, v_tax
    from billing.purchase_return_items where purchase_return_id = p_id;
  update billing.purchase_returns
    set subtotal = v_subtotal, tax_total = v_tax, total = v_subtotal + v_tax
    where id = p_id;
end;
$$;
create or replace function billing.purchase_return_items_recalc_trigger()
returns trigger language plpgsql set search_path = billing, public as $$
begin perform billing.recalc_purchase_return(coalesce(new.purchase_return_id, old.purchase_return_id)); return coalesce(new, old); end;
$$;
drop trigger if exists debit_note_items_after_change on billing.purchase_return_items;
create trigger purchase_return_items_after_change after insert or update or delete on billing.purchase_return_items
  for each row execute function billing.purchase_return_items_recalc_trigger();

-- ----------------------------------------------------------------------------
-- 6. Stock-effect triggers for the renamed tables — byte-identical logic
-- to the item-variant-aware version from 006_item_variants.sql, with every
-- credit_note*/debit_note* identifier swapped for its sales_return*/
-- purchase_return* equivalent. restore_variants_exact() and item_variants
-- itself are untouched — this is purely an identifier rename.
-- ----------------------------------------------------------------------------
create or replace function billing.sales_returns_stock_effect()
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
      select sri.id, sri.item_id, sri.quantity, sri.invoice_item_id
      from billing.sales_return_items sri
      join billing.items i on i.id = sri.item_id
      where sri.sales_return_id = new.id and i.track_inventory = true
    loop
      if new.warehouse_id is null then
        raise exception 'Sales return % has stock-tracked items but no warehouse_id set', new.id;
      end if;

      insert into billing.stock_movements
        (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, invoice_item_id, sales_return_item_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, v_item.quantity, 'sales_return', 'sales_return', new.id, v_item.invoice_item_id, v_item.id)
        returning id into v_movement_id;

      if v_item.invoice_item_id is not null then
        select id into v_original_movement_id from billing.stock_movements
          where invoice_item_id = v_item.invoice_item_id and movement_type = 'sale';

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
      select sri.id, sri.item_id, sri.quantity, sri.invoice_item_id
      from billing.sales_return_items sri
      join billing.items i on i.id = sri.item_id
      where sri.sales_return_id = new.id and i.track_inventory = true
    loop
      insert into billing.stock_movements
        (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, invoice_item_id, sales_return_item_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, -v_item.quantity, 'sales_return_void', 'sales_return', new.id, v_item.invoice_item_id, v_item.id)
        returning id into v_movement_id;

      -- Reverse the return itself (not the original sale): find the
      -- sales_return movement *this line* created, and re-consume the
      -- same variants it had restored.
      select id into v_original_movement_id from billing.stock_movements
        where sales_return_item_id = v_item.id and movement_type = 'sales_return';

      perform billing.restore_variants_exact(v_original_movement_id, v_item.quantity, v_movement_id, -1);
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists credit_notes_stock_effect on billing.sales_returns;
create trigger sales_returns_stock_effect after update of status on billing.sales_returns
  for each row when (old.status is distinct from new.status)
  execute function billing.sales_returns_stock_effect();

create or replace function billing.purchase_returns_stock_effect()
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
      select pri.id, pri.item_id, pri.quantity, pri.purchase_bill_item_id
      from billing.purchase_return_items pri
      join billing.items i on i.id = pri.item_id
      where pri.purchase_return_id = new.id and i.track_inventory = true
    loop
      if new.warehouse_id is null then
        raise exception 'Purchase return % has stock-tracked items but no warehouse_id set', new.id;
      end if;

      insert into billing.stock_movements
        (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, purchase_bill_item_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, -v_item.quantity, 'purchase_return', 'purchase_return', new.id, v_item.purchase_bill_item_id)
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
      select pri.id, pri.item_id, pri.quantity, pri.purchase_bill_item_id
      from billing.purchase_return_items pri
      join billing.items i on i.id = pri.item_id
      where pri.purchase_return_id = new.id and i.track_inventory = true
    loop
      insert into billing.stock_movements
        (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, purchase_bill_item_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, v_item.quantity, 'purchase_return_void', 'purchase_return', new.id, v_item.purchase_bill_item_id)
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
drop trigger if exists debit_notes_stock_effect on billing.purchase_returns;
create trigger purchase_returns_stock_effect after update of status on billing.purchase_returns
  for each row when (old.status is distinct from new.status)
  execute function billing.purchase_returns_stock_effect();

-- ----------------------------------------------------------------------------
-- 7. Status-transition guards for the renamed tables — reusing
-- check_simple_note_status_transition() unchanged (it's already generic,
-- driven by TG_TABLE_NAME rather than a hardcoded table name).
-- ----------------------------------------------------------------------------
drop trigger if exists credit_notes_status_transition_guard on billing.sales_returns;
create trigger sales_returns_status_transition_guard before update of status on billing.sales_returns
  for each row when (old.status is distinct from new.status)
  execute function billing.check_simple_note_status_transition();
drop trigger if exists debit_notes_status_transition_guard on billing.purchase_returns;
create trigger purchase_returns_status_transition_guard before update of status on billing.purchase_returns
  for each row when (old.status is distinct from new.status)
  execute function billing.check_simple_note_status_transition();

-- ----------------------------------------------------------------------------
-- 8. RLS helper functions + policies for the renamed tables.
-- ----------------------------------------------------------------------------
create or replace function billing.sales_return_org_id(p_id uuid)
returns uuid language sql stable set search_path = billing, public as $$
  select org_id from billing.sales_returns where id = p_id;
$$;
create or replace function billing.purchase_return_org_id(p_id uuid)
returns uuid language sql stable set search_path = billing, public as $$
  select org_id from billing.purchase_returns where id = p_id;
$$;

drop policy if exists credit_notes_select on billing.sales_returns;
drop policy if exists credit_notes_insert on billing.sales_returns;
drop policy if exists credit_notes_update on billing.sales_returns;
create policy sales_returns_select on billing.sales_returns for select using (billing.is_org_member(org_id));
create policy sales_returns_insert on billing.sales_returns for insert with check (billing.is_org_member(org_id));
create policy sales_returns_update on billing.sales_returns for update using (billing.is_org_member(org_id));

drop policy if exists credit_note_items_select on billing.sales_return_items;
drop policy if exists credit_note_items_insert on billing.sales_return_items;
drop policy if exists credit_note_items_update on billing.sales_return_items;
drop policy if exists credit_note_items_delete on billing.sales_return_items;
create policy sales_return_items_select on billing.sales_return_items for select using (billing.is_org_member(billing.sales_return_org_id(sales_return_id)));
create policy sales_return_items_insert on billing.sales_return_items for insert with check (billing.is_org_member(billing.sales_return_org_id(sales_return_id)));
create policy sales_return_items_update on billing.sales_return_items for update using (billing.is_org_member(billing.sales_return_org_id(sales_return_id)));
create policy sales_return_items_delete on billing.sales_return_items for delete using (billing.is_org_member(billing.sales_return_org_id(sales_return_id)));

drop policy if exists debit_notes_select on billing.purchase_returns;
drop policy if exists debit_notes_insert on billing.purchase_returns;
drop policy if exists debit_notes_update on billing.purchase_returns;
create policy purchase_returns_select on billing.purchase_returns for select using (billing.is_org_member(org_id));
create policy purchase_returns_insert on billing.purchase_returns for insert with check (billing.is_org_member(org_id));
create policy purchase_returns_update on billing.purchase_returns for update using (billing.is_org_member(org_id));

drop policy if exists debit_note_items_select on billing.purchase_return_items;
drop policy if exists debit_note_items_insert on billing.purchase_return_items;
drop policy if exists debit_note_items_update on billing.purchase_return_items;
drop policy if exists debit_note_items_delete on billing.purchase_return_items;
create policy purchase_return_items_select on billing.purchase_return_items for select using (billing.is_org_member(billing.purchase_return_org_id(purchase_return_id)));
create policy purchase_return_items_insert on billing.purchase_return_items for insert with check (billing.is_org_member(billing.purchase_return_org_id(purchase_return_id)));
create policy purchase_return_items_update on billing.purchase_return_items for update using (billing.is_org_member(billing.purchase_return_org_id(purchase_return_id)));
create policy purchase_return_items_delete on billing.purchase_return_items for delete using (billing.is_org_member(billing.purchase_return_org_id(purchase_return_id)));

-- No delete policy on sales_returns/purchase_returns themselves — same
-- "void, not delete" convention as every other financial document. Items
-- keep a delete policy (matches credit_note_items/debit_note_items today)
-- since a draft return's lines are editable before issue, same as every
-- other draft document's line items.

-- ============================================================================
-- 9. Fresh, slim credit_notes/debit_notes — pure value adjustments.
-- No item_id, no quantity requirement beyond "a positive line", no
-- warehouse_id, no stock-effect trigger at all: issuing one never touches
-- inventory. A line is just a description + amount + tax, the same
-- no-catalog-item shape the custom-charge/discount lines in the POS and
-- purchase-bill "Custom line" already use elsewhere in this app.
-- ============================================================================

create table billing.credit_notes (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references billing.organizations(id) on delete cascade,
  customer_id        uuid not null references billing.customers(id) on delete restrict,
  invoice_id         uuid references billing.invoices(id) on delete set null,  -- optional context, not a restocking link — a value adjustment doesn't have to reference an invoice at all (e.g. a standing goodwill credit)
  credit_note_number text,
  status             text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  issue_date         date not null default current_date,
  reason             text,
  subtotal           numeric(14, 2) not null default 0,
  tax_total          numeric(14, 2) not null default 0,
  total              numeric(14, 2) not null default 0,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, credit_note_number)
);
create index credit_notes_org_id_idx on billing.credit_notes (org_id);
create index credit_notes_invoice_id_idx on billing.credit_notes (invoice_id) where invoice_id is not null;

create table billing.credit_note_items (
  id             uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references billing.credit_notes(id) on delete cascade,
  description    text not null,
  amount         numeric(14, 2) not null,  -- signed — a straight credit is positive; deliberately no > 0 check, so a correcting/reversing line on the same note stays representable
  tax_rate       numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  line_subtotal  numeric(14, 2) not null default 0,
  line_tax       numeric(14, 2) not null default 0,
  line_total     numeric(14, 2) not null default 0,
  created_at     timestamptz not null default now()
);
create index credit_note_items_credit_note_id_idx on billing.credit_note_items (credit_note_id);

create table billing.debit_notes (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references billing.organizations(id) on delete cascade,
  vendor_id         uuid not null references billing.vendors(id) on delete restrict,
  purchase_bill_id  uuid references billing.purchase_bills(id) on delete set null,
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
create index debit_notes_bill_id_idx on billing.debit_notes (purchase_bill_id) where purchase_bill_id is not null;

create table billing.debit_note_items (
  id             uuid primary key default gen_random_uuid(),
  debit_note_id  uuid not null references billing.debit_notes(id) on delete cascade,
  description    text not null,
  amount         numeric(14, 2) not null,
  tax_rate       numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  line_subtotal  numeric(14, 2) not null default 0,
  line_tax       numeric(14, 2) not null default 0,
  line_total     numeric(14, 2) not null default 0,
  created_at     timestamptz not null default now()
);
create index debit_note_items_debit_note_id_idx on billing.debit_note_items (debit_note_id);

-- Line math — same shape as compute_line_totals_price()/_cost() but keyed
-- off a signed `amount` instead of quantity*unit_price, since a value
-- adjustment has no meaningful "quantity".
create or replace function billing.compute_note_line_totals()
returns trigger language plpgsql set search_path = billing, public as $$
begin
  new.line_subtotal := new.amount;
  new.line_tax := round(new.amount * new.tax_rate / 100, 2);
  new.line_total := new.line_subtotal + new.line_tax;
  return new;
end;
$$;
create trigger credit_note_items_compute_totals before insert or update on billing.credit_note_items
  for each row execute function billing.compute_note_line_totals();
create trigger debit_note_items_compute_totals before insert or update on billing.debit_note_items
  for each row execute function billing.compute_note_line_totals();

create or replace function billing.recalc_credit_note(p_id uuid)
returns void language plpgsql set search_path = billing, public as $$
declare v_subtotal numeric(14,2); v_tax numeric(14,2);
begin
  perform 1 from billing.credit_notes where id = p_id for update;
  select coalesce(sum(line_subtotal), 0), coalesce(sum(line_tax), 0)
    into v_subtotal, v_tax
    from billing.credit_note_items where credit_note_id = p_id;
  update billing.credit_notes
    set subtotal = v_subtotal, tax_total = v_tax, total = v_subtotal + v_tax
    where id = p_id;
end;
$$;
create or replace function billing.credit_note_items_recalc_trigger()
returns trigger language plpgsql set search_path = billing, public as $$
begin perform billing.recalc_credit_note(coalesce(new.credit_note_id, old.credit_note_id)); return coalesce(new, old); end;
$$;
create trigger credit_note_items_after_change after insert or update or delete on billing.credit_note_items
  for each row execute function billing.credit_note_items_recalc_trigger();

create or replace function billing.recalc_debit_note(p_id uuid)
returns void language plpgsql set search_path = billing, public as $$
declare v_subtotal numeric(14,2); v_tax numeric(14,2);
begin
  perform 1 from billing.debit_notes where id = p_id for update;
  select coalesce(sum(line_subtotal), 0), coalesce(sum(line_tax), 0)
    into v_subtotal, v_tax
    from billing.debit_note_items where debit_note_id = p_id;
  update billing.debit_notes
    set subtotal = v_subtotal, tax_total = v_tax, total = v_subtotal + v_tax
    where id = p_id;
end;
$$;
create or replace function billing.debit_note_items_recalc_trigger()
returns trigger language plpgsql set search_path = billing, public as $$
begin perform billing.recalc_debit_note(coalesce(new.debit_note_id, old.debit_note_id)); return coalesce(new, old); end;
$$;
create trigger debit_note_items_after_change after insert or update or delete on billing.debit_note_items
  for each row execute function billing.debit_note_items_recalc_trigger();

create or replace function billing.assign_credit_note_number()
returns trigger language plpgsql set search_path = billing, public as $$
declare v_prefix text;
begin
  if new.credit_note_number is null then
    select credit_note_prefix into v_prefix from billing.organizations where id = new.org_id;
    new.credit_note_number := billing.next_document_number(new.org_id, 'credit_note', v_prefix);
  end if;
  return new;
end;
$$;
create trigger credit_notes_assign_number before insert on billing.credit_notes
  for each row execute function billing.assign_credit_note_number();

create or replace function billing.assign_debit_note_number()
returns trigger language plpgsql set search_path = billing, public as $$
declare v_prefix text;
begin
  if new.debit_note_number is null then
    select debit_note_prefix into v_prefix from billing.organizations where id = new.org_id;
    new.debit_note_number := billing.next_document_number(new.org_id, 'debit_note', v_prefix);
  end if;
  return new;
end;
$$;
create trigger debit_notes_assign_number before insert on billing.debit_notes
  for each row execute function billing.assign_debit_note_number();

create trigger credit_notes_status_transition_guard before update of status on billing.credit_notes
  for each row when (old.status is distinct from new.status)
  execute function billing.check_simple_note_status_transition();
create trigger debit_notes_status_transition_guard before update of status on billing.debit_notes
  for each row when (old.status is distinct from new.status)
  execute function billing.check_simple_note_status_transition();

create or replace function billing.credit_note_org_id(p_id uuid)
returns uuid language sql stable set search_path = billing, public as $$
  select org_id from billing.credit_notes where id = p_id;
$$;
create or replace function billing.debit_note_org_id(p_id uuid)
returns uuid language sql stable set search_path = billing, public as $$
  select org_id from billing.debit_notes where id = p_id;
$$;

alter table billing.credit_notes enable row level security;
create policy credit_notes_select on billing.credit_notes for select using (billing.is_org_member(org_id));
create policy credit_notes_insert on billing.credit_notes for insert with check (billing.is_org_member(org_id));
create policy credit_notes_update on billing.credit_notes for update using (billing.is_org_member(org_id));

alter table billing.credit_note_items enable row level security;
create policy credit_note_items_select on billing.credit_note_items for select using (billing.is_org_member(billing.credit_note_org_id(credit_note_id)));
create policy credit_note_items_insert on billing.credit_note_items for insert with check (billing.is_org_member(billing.credit_note_org_id(credit_note_id)));
create policy credit_note_items_update on billing.credit_note_items for update using (billing.is_org_member(billing.credit_note_org_id(credit_note_id)));
create policy credit_note_items_delete on billing.credit_note_items for delete using (billing.is_org_member(billing.credit_note_org_id(credit_note_id)));

alter table billing.debit_notes enable row level security;
create policy debit_notes_select on billing.debit_notes for select using (billing.is_org_member(org_id));
create policy debit_notes_insert on billing.debit_notes for insert with check (billing.is_org_member(org_id));
create policy debit_notes_update on billing.debit_notes for update using (billing.is_org_member(org_id));

alter table billing.debit_note_items enable row level security;
create policy debit_note_items_select on billing.debit_note_items for select using (billing.is_org_member(billing.debit_note_org_id(debit_note_id)));
create policy debit_note_items_insert on billing.debit_note_items for insert with check (billing.is_org_member(billing.debit_note_org_id(debit_note_id)));
create policy debit_note_items_update on billing.debit_note_items for update using (billing.is_org_member(billing.debit_note_org_id(debit_note_id)));
create policy debit_note_items_delete on billing.debit_note_items for delete using (billing.is_org_member(billing.debit_note_org_id(debit_note_id)));

-- No delete policy on credit_notes/debit_notes themselves — same
-- "void, not delete" convention as every financial document in this
-- schema. Items keep a delete policy, same as every other draft
-- document's line items.

-- 004_grants.sql's `alter default privileges` already covers new tables in
-- this schema automatically, as long as this migration runs under the
-- same role 004 did (true for the normal Supabase SQL editor / postgres
-- role this project's migrations have always been applied through).
