-- ============================================================================
-- nucleus-billing — fix triggers 010_returns_split.sql missed
--
-- 010_returns_split.sql correctly rewrote every trigger function whose body
-- referenced the renamed tables' own identifiers (recalc_*, *_stock_effect,
-- the numbering triggers, the RLS helper functions) — but missed two more
-- functions that ALSO hardcode references to the old credit_note*/
-- debit_note* names, discovered by live testing against a real invoice ->
-- sales return flow after the migration ran:
--
-- 1. billing.lock_items_after_draft() branches on TG_TABLE_NAME with a
--    hardcoded if/elsif chain. Since ALTER TABLE RENAME carries a table's
--    triggers along with it, the credit_note_items_lock/debit_note_items_lock
--    triggers are still attached — now firing with TG_TABLE_NAME =
--    'sales_return_items' / 'purchase_return_items', which the function's
--    branching didn't recognize. v_status was silently left NULL, and
--    `NULL is distinct from 'draft'` is true, so the trigger unconditionally
--    rejected every insert/update/delete — sales returns and purchase
--    returns could never actually get a line item added, in draft or not.
--    Confirmed live: POSTing a sales_return_item failed with "Cannot modify
--    line items on sales_return_items <NULL> — status is <NULL>" even
--    against a brand-new draft return.
--
-- 2. billing.credit_note_items_validate_quantity() / _debit_note_items_
--    validate_quantity() don't branch on TG_TABLE_NAME at all — their SQL
--    bodies hardcode `from billing.credit_note_items cni join
--    billing.credit_notes cn` (and the debit_note equivalent) *by literal
--    name*. Same rename-carries-the-trigger mechanism means these two
--    triggers are still attached to sales_return_items/purchase_return_items
--    — but `billing.credit_note_items`/`billing.credit_notes` now resolve to
--    the brand-new SLIM tables created in 010's section 9, which have no
--    `quantity` or `invoice_item_id` columns at all. This would have failed
--    with a column-does-not-exist error the first time it fired (never
--    actually observed live, since bug 1's trigger fires first
--    alphabetically and blocked every write before this one could run).
--
-- Also: the new slim credit_notes/debit_notes tables from 010's section 9
-- never got a lock_items_after_draft trigger attached at all (it's a
-- brand-new table, not a renamed one — nothing carries over automatically).
-- Their line items could be edited/deleted after the parent left draft,
-- silently violating the same "line items lock once issued" rule every
-- other financial document in this schema follows.
--
-- Fix, in order: extend lock_items_after_draft() with the two missing
-- branches; attach it to the new slim tables; replace the two quantity-
-- validation functions with correctly-scoped sales_return/purchase_return
-- versions (renamed to match, old stale-named triggers dropped). Also
-- renames the handful of triggers that still carry their pre-rename names
-- (cosmetic only, but confusing to leave as-is) — credit_note_items_lock
-- etc. now genuinely fire on sales_return_items, so the trigger name should
-- say so.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. lock_items_after_draft() — add the two missing branches.
-- ----------------------------------------------------------------------------
create or replace function billing.lock_items_after_draft()
returns trigger language plpgsql set search_path = billing, public as $$
declare
  v_parent_id uuid;
  v_status text;
begin
  if TG_TABLE_NAME = 'invoice_items' then
    v_parent_id := coalesce(new.invoice_id, old.invoice_id);
    select status into v_status from billing.invoices where id = v_parent_id;
  elsif TG_TABLE_NAME = 'purchase_bill_items' then
    v_parent_id := coalesce(new.purchase_bill_id, old.purchase_bill_id);
    select status into v_status from billing.purchase_bills where id = v_parent_id;
  elsif TG_TABLE_NAME = 'credit_note_items' then
    v_parent_id := coalesce(new.credit_note_id, old.credit_note_id);
    select status into v_status from billing.credit_notes where id = v_parent_id;
  elsif TG_TABLE_NAME = 'debit_note_items' then
    v_parent_id := coalesce(new.debit_note_id, old.debit_note_id);
    select status into v_status from billing.debit_notes where id = v_parent_id;
  elsif TG_TABLE_NAME = 'sales_return_items' then
    v_parent_id := coalesce(new.sales_return_id, old.sales_return_id);
    select status into v_status from billing.sales_returns where id = v_parent_id;
  elsif TG_TABLE_NAME = 'purchase_return_items' then
    v_parent_id := coalesce(new.purchase_return_id, old.purchase_return_id);
    select status into v_status from billing.purchase_returns where id = v_parent_id;
  end if;

  if v_status is distinct from 'draft' then
    raise exception 'Cannot modify line items on % % — status is % (only draft documents are editable); void and reissue instead',
      TG_TABLE_NAME, v_parent_id, v_status;
  end if;

  return coalesce(new, old);
end;
$$;

-- Rename the pre-rename-named triggers to match what they actually fire on
-- now (cosmetic — same function, same behavior, clearer name).
alter trigger credit_note_items_lock on billing.sales_return_items rename to sales_return_items_lock;
alter trigger debit_note_items_lock on billing.purchase_return_items rename to purchase_return_items_lock;

-- The new slim credit_notes/debit_notes tables never got this trigger —
-- they're brand-new tables, nothing carries over from a rename.
create trigger credit_note_items_lock before insert or update or delete on billing.credit_note_items
  for each row execute function billing.lock_items_after_draft();
create trigger debit_note_items_lock before insert or update or delete on billing.debit_note_items
  for each row execute function billing.lock_items_after_draft();

-- ----------------------------------------------------------------------------
-- 2. Replace the two quantity-validation triggers still attached (under
-- their old names) to sales_return_items/purchase_return_items with
-- correctly-scoped, correctly-named versions.
-- ----------------------------------------------------------------------------
drop trigger if exists credit_note_items_validate_quantity on billing.sales_return_items;
drop trigger if exists debit_note_items_validate_quantity on billing.purchase_return_items;

create or replace function billing.sales_return_items_validate_quantity()
returns trigger language plpgsql set search_path = billing, public as $$
declare
  v_original_qty numeric(14,4);
  v_already_returned numeric(14,4);
begin
  if new.invoice_item_id is null then
    return new;
  end if;

  select quantity into v_original_qty from billing.invoice_items where id = new.invoice_item_id;

  select coalesce(sum(sri.quantity), 0) into v_already_returned
    from billing.sales_return_items sri
    join billing.sales_returns sr on sr.id = sri.sales_return_id
    where sri.invoice_item_id = new.invoice_item_id
      and sr.status <> 'void'
      and sri.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_original_qty is not null and v_already_returned + new.quantity > v_original_qty then
    raise exception 'Cannot return % units on invoice line % — only % of % remain unreturned',
      new.quantity, new.invoice_item_id, v_original_qty - v_already_returned, v_original_qty;
  end if;

  return new;
end;
$$;
create trigger sales_return_items_validate_quantity before insert or update on billing.sales_return_items
  for each row execute function billing.sales_return_items_validate_quantity();

create or replace function billing.purchase_return_items_validate_quantity()
returns trigger language plpgsql set search_path = billing, public as $$
declare
  v_original_qty numeric(14,4);
  v_already_returned numeric(14,4);
begin
  if new.purchase_bill_item_id is null then
    return new;
  end if;

  select quantity into v_original_qty from billing.purchase_bill_items where id = new.purchase_bill_item_id;

  select coalesce(sum(pri.quantity), 0) into v_already_returned
    from billing.purchase_return_items pri
    join billing.purchase_returns pr on pr.id = pri.purchase_return_id
    where pri.purchase_bill_item_id = new.purchase_bill_item_id
      and pr.status <> 'void'
      and pri.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_original_qty is not null and v_already_returned + new.quantity > v_original_qty then
    raise exception 'Cannot return % units on purchase bill line % — only % of % remain unreturned',
      new.quantity, new.purchase_bill_item_id, v_original_qty - v_already_returned, v_original_qty;
  end if;

  return new;
end;
$$;
create trigger purchase_return_items_validate_quantity before insert or update on billing.purchase_return_items
  for each row execute function billing.purchase_return_items_validate_quantity();

-- ----------------------------------------------------------------------------
-- 3. Cosmetic: rename the remaining stale-named trigger on the renamed
-- tables so nothing left in pg_trigger still says "credit_note"/"debit_note"
-- for what is now a sales_return/purchase_return. set_updated_at() itself
-- is fully generic (no table-name dependency), so this is a name-only change.
-- ----------------------------------------------------------------------------
alter trigger credit_notes_set_updated_at on billing.sales_returns rename to sales_returns_set_updated_at;
alter trigger debit_notes_set_updated_at on billing.purchase_returns rename to purchase_returns_set_updated_at;
