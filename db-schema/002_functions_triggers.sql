-- ============================================================================
-- nucleus-billing — functions & triggers v3
-- Run after 001_billing_schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- updated_at bump, reused everywhere
-- ----------------------------------------------------------------------------
create or replace function billing.set_updated_at()
returns trigger language plpgsql set search_path = billing, public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at before update on billing.organizations
  for each row execute function billing.set_updated_at();
create trigger customers_set_updated_at before update on billing.customers
  for each row execute function billing.set_updated_at();
create trigger vendors_set_updated_at before update on billing.vendors
  for each row execute function billing.set_updated_at();
create trigger items_set_updated_at before update on billing.items
  for each row execute function billing.set_updated_at();
create trigger invoices_set_updated_at before update on billing.invoices
  for each row execute function billing.set_updated_at();
create trigger purchase_bills_set_updated_at before update on billing.purchase_bills
  for each row execute function billing.set_updated_at();
create trigger credit_notes_set_updated_at before update on billing.credit_notes
  for each row execute function billing.set_updated_at();
create trigger debit_notes_set_updated_at before update on billing.debit_notes
  for each row execute function billing.set_updated_at();
create trigger offers_set_updated_at before update on billing.offers
  for each row execute function billing.set_updated_at();
create trigger organization_addon_subscriptions_set_updated_at before update on billing.organization_addon_subscriptions
  for each row execute function billing.set_updated_at();

-- ----------------------------------------------------------------------------
-- Document number assignment — one thin wrapper per document type, all
-- calling the shared billing.next_document_number() from 001.
-- ----------------------------------------------------------------------------
create or replace function billing.assign_invoice_number()
returns trigger language plpgsql set search_path = billing, public as $$
declare v_prefix text;
begin
  if new.invoice_number is null then
    select invoice_prefix into v_prefix from billing.organizations where id = new.org_id;
    new.invoice_number := billing.next_document_number(new.org_id, 'invoice', v_prefix);
  end if;
  return new;
end;
$$;
create trigger invoices_assign_number before insert on billing.invoices
  for each row execute function billing.assign_invoice_number();

create or replace function billing.assign_bill_number()
returns trigger language plpgsql set search_path = billing, public as $$
declare v_prefix text;
begin
  if new.bill_number is null then
    select bill_prefix into v_prefix from billing.organizations where id = new.org_id;
    new.bill_number := billing.next_document_number(new.org_id, 'purchase_bill', v_prefix);
  end if;
  return new;
end;
$$;
create trigger purchase_bills_assign_number before insert on billing.purchase_bills
  for each row execute function billing.assign_bill_number();

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

-- ----------------------------------------------------------------------------
-- Line-item math. Two variants since sales-side lines use unit_price and
-- purchase-side lines use unit_cost — same shape otherwise.
-- ----------------------------------------------------------------------------
create or replace function billing.compute_line_totals_price()
returns trigger language plpgsql set search_path = billing, public as $$
begin
  new.line_subtotal := round(new.quantity * new.unit_price, 2);
  new.line_tax := round(new.line_subtotal * new.tax_rate / 100, 2);
  new.line_total := new.line_subtotal + new.line_tax;
  return new;
end;
$$;
create trigger invoice_items_compute_totals before insert or update on billing.invoice_items
  for each row execute function billing.compute_line_totals_price();
create trigger credit_note_items_compute_totals before insert or update on billing.credit_note_items
  for each row execute function billing.compute_line_totals_price();

create or replace function billing.compute_line_totals_cost()
returns trigger language plpgsql set search_path = billing, public as $$
begin
  new.line_subtotal := round(new.quantity * new.unit_cost, 2);
  new.line_tax := round(new.line_subtotal * new.tax_rate / 100, 2);
  new.line_total := new.line_subtotal + new.line_tax;
  return new;
end;
$$;
create trigger purchase_bill_items_compute_totals before insert or update on billing.purchase_bill_items
  for each row execute function billing.compute_line_totals_cost();
create trigger debit_note_items_compute_totals before insert or update on billing.debit_note_items
  for each row execute function billing.compute_line_totals_cost();

-- ----------------------------------------------------------------------------
-- Roll-ups: invoice/bill totals derived from their line items + payments.
-- Draft and void are left alone; every other status is re-derived.
--
-- Each recalc_* function takes a row lock on its parent document FIRST
-- (before aggregating), so two concurrent writes (e.g. two payments landing
-- at once) serialize instead of one silently overwriting the other's totals
-- with a stale sum.
--
-- Writing status here (to 'sent'/'partially_paid'/'paid'/'received') would
-- normally be blocked by the status-transition guard trigger below, since
-- those are meant to be system-derived, not directly settable. We flip
-- billing.internal_recalc to 'on' for the duration of the UPDATE so the
-- guard recognizes this as the trusted, derived write it is.
-- ----------------------------------------------------------------------------
create or replace function billing.recalc_invoice(p_invoice_id uuid)
returns void language plpgsql set search_path = billing, public as $$
declare
  v_subtotal numeric(14,2);
  v_tax_total numeric(14,2);
  v_discount numeric(14,2) := 0;
  v_total numeric(14,2);
  v_paid numeric(14,2);
  v_status text;
  v_offer_id uuid;
  v_discount_type text;
  v_discount_value numeric(14,2);
  v_offer_active boolean;
  v_offer_in_window boolean;
begin
  perform 1 from billing.invoices where id = p_invoice_id for update;

  select coalesce(sum(line_subtotal), 0), coalesce(sum(line_tax), 0)
    into v_subtotal, v_tax_total
    from billing.invoice_items where invoice_id = p_invoice_id;

  select offer_id, status into v_offer_id, v_status
    from billing.invoices where id = p_invoice_id;

  if v_offer_id is not null then
    select discount_type, value, is_active,
           (starts_at is null or starts_at <= current_date)
             and (ends_at is null or ends_at >= current_date)
      into v_discount_type, v_discount_value, v_offer_active, v_offer_in_window
      from billing.offers where id = v_offer_id;

    if v_offer_active and v_offer_in_window then
      if v_discount_type = 'percentage' then
        v_discount := round(v_subtotal * v_discount_value / 100, 2);
      else
        v_discount := least(v_discount_value, v_subtotal + v_tax_total);
      end if;
    end if;
  end if;

  v_total := v_subtotal + v_tax_total - v_discount;

  select coalesce(sum(amount), 0) into v_paid
    from billing.payments where invoice_id = p_invoice_id;

  if v_status not in ('draft', 'void') then
    if v_paid <= 0 then v_status := 'sent';
    elsif v_paid < v_total then v_status := 'partially_paid';
    else v_status := 'paid';
    end if;
  end if;

  perform set_config('billing.internal_recalc', 'on', true);
  update billing.invoices
    set subtotal = v_subtotal, tax_total = v_tax_total, discount_total = v_discount,
        total = v_total, amount_paid = v_paid, status = v_status
    where id = p_invoice_id;
end;
$$;

create or replace function billing.recalc_purchase_bill(p_bill_id uuid)
returns void language plpgsql set search_path = billing, public as $$
declare
  v_subtotal numeric(14,2);
  v_tax_total numeric(14,2);
  v_total numeric(14,2);
  v_paid numeric(14,2);
  v_status text;
begin
  perform 1 from billing.purchase_bills where id = p_bill_id for update;

  select coalesce(sum(line_subtotal), 0), coalesce(sum(line_tax), 0)
    into v_subtotal, v_tax_total
    from billing.purchase_bill_items where purchase_bill_id = p_bill_id;

  v_total := v_subtotal + v_tax_total;

  select coalesce(sum(amount), 0) into v_paid
    from billing.purchase_payments where purchase_bill_id = p_bill_id;

  select status into v_status from billing.purchase_bills where id = p_bill_id;

  if v_status not in ('draft', 'void') then
    if v_paid <= 0 then v_status := 'received';
    elsif v_paid < v_total then v_status := 'partially_paid';
    else v_status := 'paid';
    end if;
  end if;

  perform set_config('billing.internal_recalc', 'on', true);
  update billing.purchase_bills
    set subtotal = v_subtotal, tax_total = v_tax_total, total = v_total,
        amount_paid = v_paid, status = v_status
    where id = p_bill_id;
end;
$$;

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

-- Trigger wrappers that call the recalcs above whenever lines/payments change.
create or replace function billing.invoice_items_recalc_trigger()
returns trigger language plpgsql set search_path = billing, public as $$
begin perform billing.recalc_invoice(coalesce(new.invoice_id, old.invoice_id)); return coalesce(new, old); end;
$$;
create trigger invoice_items_after_change after insert or update or delete on billing.invoice_items
  for each row execute function billing.invoice_items_recalc_trigger();

create or replace function billing.payments_recalc_trigger()
returns trigger language plpgsql set search_path = billing, public as $$
begin perform billing.recalc_invoice(coalesce(new.invoice_id, old.invoice_id)); return coalesce(new, old); end;
$$;
create trigger payments_after_change after insert or update or delete on billing.payments
  for each row execute function billing.payments_recalc_trigger();

create or replace function billing.invoices_offer_change_trigger()
returns trigger language plpgsql set search_path = billing, public as $$
begin perform billing.recalc_invoice(new.id); return new; end;
$$;
create trigger invoices_offer_change after update of offer_id on billing.invoices
  for each row when (old.offer_id is distinct from new.offer_id)
  execute function billing.invoices_offer_change_trigger();

create or replace function billing.credit_note_items_recalc_trigger()
returns trigger language plpgsql set search_path = billing, public as $$
begin perform billing.recalc_credit_note(coalesce(new.credit_note_id, old.credit_note_id)); return coalesce(new, old); end;
$$;
create trigger credit_note_items_after_change after insert or update or delete on billing.credit_note_items
  for each row execute function billing.credit_note_items_recalc_trigger();

create or replace function billing.purchase_bill_items_recalc_trigger()
returns trigger language plpgsql set search_path = billing, public as $$
begin perform billing.recalc_purchase_bill(coalesce(new.purchase_bill_id, old.purchase_bill_id)); return coalesce(new, old); end;
$$;
create trigger purchase_bill_items_after_change after insert or update or delete on billing.purchase_bill_items
  for each row execute function billing.purchase_bill_items_recalc_trigger();

create or replace function billing.purchase_payments_recalc_trigger()
returns trigger language plpgsql set search_path = billing, public as $$
begin perform billing.recalc_purchase_bill(coalesce(new.purchase_bill_id, old.purchase_bill_id)); return coalesce(new, old); end;
$$;
create trigger purchase_payments_after_change after insert or update or delete on billing.purchase_payments
  for each row execute function billing.purchase_payments_recalc_trigger();

create or replace function billing.debit_note_items_recalc_trigger()
returns trigger language plpgsql set search_path = billing, public as $$
begin perform billing.recalc_debit_note(coalesce(new.debit_note_id, old.debit_note_id)); return coalesce(new, old); end;
$$;
create trigger debit_note_items_after_change after insert or update or delete on billing.debit_note_items
  for each row execute function billing.debit_note_items_recalc_trigger();

-- ----------------------------------------------------------------------------
-- Status-transition guards. Plain status columns are directly writable by
-- any org member, which without a guard means: a confirmed document can be
-- pushed back to 'draft' and re-confirmed (double-firing the stock effect
-- below), a void document can be un-voided without restoring what it
-- reversed, and 'paid'/'partially_paid'/'received' — which are supposed to
-- be strictly earned by recorded payments — can simply be typed in. These
-- triggers close all three. recalc_invoice()/recalc_purchase_bill() flip
-- billing.internal_recalc to 'on' for their own derived writes, which is
-- how their legitimate status changes get past this same guard.
-- ----------------------------------------------------------------------------
create or replace function billing.check_invoice_status_transition()
returns trigger language plpgsql set search_path = billing, public as $$
begin
  if current_setting('billing.internal_recalc', true) = 'on' then
    return new;
  end if;

  if old.status = 'void' then
    raise exception 'Invoice % is void — void is terminal', old.id;
  end if;

  if new.status = 'draft' then
    raise exception 'Invoice % cannot move back to draft once confirmed', old.id;
  end if;

  if old.status = 'draft' and new.status not in ('sent', 'void') then
    raise exception 'Invoice % can only move from draft to sent or void directly', old.id;
  end if;

  if new.status in ('paid', 'partially_paid') then
    raise exception '% is derived from recorded payments — record a payment instead of setting status directly', new.status;
  end if;

  return new;
end;
$$;
create trigger invoices_status_transition_guard before update of status on billing.invoices
  for each row when (old.status is distinct from new.status)
  execute function billing.check_invoice_status_transition();

create or replace function billing.check_purchase_bill_status_transition()
returns trigger language plpgsql set search_path = billing, public as $$
begin
  if current_setting('billing.internal_recalc', true) = 'on' then
    return new;
  end if;

  if old.status = 'void' then
    raise exception 'Purchase bill % is void — void is terminal', old.id;
  end if;

  if new.status = 'draft' then
    raise exception 'Purchase bill % cannot move back to draft once confirmed', old.id;
  end if;

  if old.status = 'draft' and new.status not in ('received', 'void') then
    raise exception 'Purchase bill % can only move from draft to received or void directly', old.id;
  end if;

  if new.status in ('paid', 'partially_paid') then
    raise exception '% is derived from recorded payments — record a payment instead of setting status directly', new.status;
  end if;

  return new;
end;
$$;
create trigger purchase_bills_status_transition_guard before update of status on billing.purchase_bills
  for each row when (old.status is distinct from new.status)
  execute function billing.check_purchase_bill_status_transition();

create or replace function billing.check_simple_note_status_transition()
returns trigger language plpgsql set search_path = billing, public as $$
begin
  if old.status = 'void' then
    raise exception '% % is void — void is terminal', TG_TABLE_NAME, old.id;
  end if;
  if new.status = 'draft' then
    raise exception '% % cannot move back to draft once confirmed', TG_TABLE_NAME, old.id;
  end if;
  if old.status = 'draft' and new.status not in ('issued', 'void') then
    raise exception '% % can only move from draft to issued or void directly', TG_TABLE_NAME, old.id;
  end if;
  return new;
end;
$$;
create trigger credit_notes_status_transition_guard before update of status on billing.credit_notes
  for each row when (old.status is distinct from new.status)
  execute function billing.check_simple_note_status_transition();
create trigger debit_notes_status_transition_guard before update of status on billing.debit_notes
  for each row when (old.status is distinct from new.status)
  execute function billing.check_simple_note_status_transition();

-- ----------------------------------------------------------------------------
-- Once a document has left 'draft', its line items are locked. Editing
-- quantities/prices on a document that's already been confirmed (stock
-- moved, possibly already shown to a customer/vendor) would silently drift
-- the total away from what actually happened — void and reissue instead.
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
  end if;

  if v_status is distinct from 'draft' then
    raise exception 'Cannot modify line items on % % — status is % (only draft documents are editable); void and reissue instead',
      TG_TABLE_NAME, v_parent_id, v_status;
  end if;

  return coalesce(new, old);
end;
$$;
create trigger invoice_items_lock before insert or update or delete on billing.invoice_items
  for each row execute function billing.lock_items_after_draft();
create trigger purchase_bill_items_lock before insert or update or delete on billing.purchase_bill_items
  for each row execute function billing.lock_items_after_draft();
create trigger credit_note_items_lock before insert or update or delete on billing.credit_note_items
  for each row execute function billing.lock_items_after_draft();
create trigger debit_note_items_lock before insert or update or delete on billing.debit_note_items
  for each row execute function billing.lock_items_after_draft();

-- ----------------------------------------------------------------------------
-- A payment can't be recorded against a document that isn't actually
-- confirmed yet (draft) or has been cancelled (void) — otherwise
-- amount_paid could carry a balance the document's own status disowns.
-- ----------------------------------------------------------------------------
create or replace function billing.payments_guard_invoice_status()
returns trigger language plpgsql set search_path = billing, public as $$
declare v_status text;
begin
  select status into v_status from billing.invoices where id = new.invoice_id;
  if v_status in ('draft', 'void') then
    raise exception 'Cannot record a payment against invoice % — status is %', new.invoice_id, v_status;
  end if;
  return new;
end;
$$;
create trigger payments_guard_status before insert on billing.payments
  for each row execute function billing.payments_guard_invoice_status();

create or replace function billing.purchase_payments_guard_bill_status()
returns trigger language plpgsql set search_path = billing, public as $$
declare v_status text;
begin
  select status into v_status from billing.purchase_bills where id = new.purchase_bill_id;
  if v_status in ('draft', 'void') then
    raise exception 'Cannot record a payment against purchase bill % — status is %', new.purchase_bill_id, v_status;
  end if;
  return new;
end;
$$;
create trigger purchase_payments_guard_status before insert on billing.purchase_payments
  for each row execute function billing.purchase_payments_guard_bill_status();

-- ----------------------------------------------------------------------------
-- A return can't exceed what was actually sold/bought on the line it's
-- returning against. Only checked when linked back to the original line
-- (invoice_item_id / purchase_bill_item_id) — an unlinked, free-form return
-- line skips this, same as it always has.
-- ----------------------------------------------------------------------------
create or replace function billing.credit_note_items_validate_quantity()
returns trigger language plpgsql set search_path = billing, public as $$
declare
  v_original_qty numeric(14,4);
  v_already_returned numeric(14,4);
begin
  if new.invoice_item_id is null then
    return new;
  end if;

  select quantity into v_original_qty from billing.invoice_items where id = new.invoice_item_id;

  select coalesce(sum(cni.quantity), 0) into v_already_returned
    from billing.credit_note_items cni
    join billing.credit_notes cn on cn.id = cni.credit_note_id
    where cni.invoice_item_id = new.invoice_item_id
      and cn.status <> 'void'
      and cni.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_original_qty is not null and v_already_returned + new.quantity > v_original_qty then
    raise exception 'Cannot return % units on invoice line % — only % of % remain unreturned',
      new.quantity, new.invoice_item_id, v_original_qty - v_already_returned, v_original_qty;
  end if;

  return new;
end;
$$;
create trigger credit_note_items_validate_quantity before insert or update on billing.credit_note_items
  for each row execute function billing.credit_note_items_validate_quantity();

create or replace function billing.debit_note_items_validate_quantity()
returns trigger language plpgsql set search_path = billing, public as $$
declare
  v_original_qty numeric(14,4);
  v_already_returned numeric(14,4);
begin
  if new.purchase_bill_item_id is null then
    return new;
  end if;

  select quantity into v_original_qty from billing.purchase_bill_items where id = new.purchase_bill_item_id;

  select coalesce(sum(dni.quantity), 0) into v_already_returned
    from billing.debit_note_items dni
    join billing.debit_notes dn on dn.id = dni.debit_note_id
    where dni.purchase_bill_item_id = new.purchase_bill_item_id
      and dn.status <> 'void'
      and dni.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_original_qty is not null and v_already_returned + new.quantity > v_original_qty then
    raise exception 'Cannot return % units on purchase bill line % — only % of % remain unreturned',
      new.quantity, new.purchase_bill_item_id, v_original_qty - v_already_returned, v_original_qty;
  end if;

  return new;
end;
$$;
create trigger debit_note_items_validate_quantity before insert or update on billing.debit_note_items
  for each row execute function billing.debit_note_items_validate_quantity();

-- ----------------------------------------------------------------------------
-- Stock ledger: item_stock is always derived from stock_movements, never
-- written directly. Movements are append-only — corrections are offsetting
-- rows, never edits.
-- ----------------------------------------------------------------------------
create or replace function billing.stock_movements_apply()
returns trigger
language plpgsql
security definer
set search_path = billing, public
as $$
begin
  insert into billing.item_stock (item_id, warehouse_id, quantity_on_hand)
    values (new.item_id, new.warehouse_id, new.quantity_delta)
  on conflict (item_id, warehouse_id) do update
    set quantity_on_hand = billing.item_stock.quantity_on_hand + excluded.quantity_on_hand;
  return new;
end;
$$;
create trigger stock_movements_after_insert after insert on billing.stock_movements
  for each row execute function billing.stock_movements_apply();

create or replace function billing.stock_movements_immutable()
returns trigger language plpgsql set search_path = billing, public as $$
begin
  raise exception 'billing.stock_movements is append-only — insert an offsetting row instead of modifying id %',
    coalesce(old.id, new.id);
end;
$$;
create trigger stock_movements_no_update before update on billing.stock_movements
  for each row execute function billing.stock_movements_immutable();
create trigger stock_movements_no_delete before delete on billing.stock_movements
  for each row execute function billing.stock_movements_immutable();

-- ----------------------------------------------------------------------------
-- Stock effects: fire once when a document's status leaves 'draft' (moving
-- real stock for the first time), and reverse if it's later voided. Editing
-- line items after a document has left draft does NOT retroactively adjust
-- stock in this version — void and reissue instead of editing a confirmed
-- document. See APPLY.md.
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER: these four stock-effect functions are the only things
-- allowed to write 'sale'/'purchase'/'sales_return'/'purchase_return' (and
-- their _void reversals) into stock_movements — the RLS insert policy on
-- that table (003) restricts ordinary member writes to movement_type =
-- 'adjustment' only, so a client can't fabricate a fake sale/purchase
-- directly. These functions bypass that restriction deliberately, since
-- they only ever run as a direct, non-negotiable consequence of a
-- document's own status changing.
create or replace function billing.invoices_stock_effect()
returns trigger
language plpgsql
security definer
set search_path = billing, public
as $$
declare v_item record;
begin
  if old.status = 'draft' and new.status not in ('draft', 'void') then
    for v_item in
      select ii.item_id, ii.quantity from billing.invoice_items ii
      join billing.items i on i.id = ii.item_id
      where ii.invoice_id = new.id and i.track_inventory = true
    loop
      if new.warehouse_id is null then
        raise exception 'Invoice % has stock-tracked items but no warehouse_id set', new.id;
      end if;
      insert into billing.stock_movements (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, -v_item.quantity, 'sale', 'invoice', new.id);
    end loop;
  elsif old.status not in ('draft', 'void') and new.status = 'void' then
    for v_item in
      select ii.item_id, ii.quantity from billing.invoice_items ii
      join billing.items i on i.id = ii.item_id
      where ii.invoice_id = new.id and i.track_inventory = true
    loop
      insert into billing.stock_movements (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, v_item.quantity, 'sale_void', 'invoice', new.id);
    end loop;
  end if;
  return new;
end;
$$;
create trigger invoices_stock_effect after update of status on billing.invoices
  for each row when (old.status is distinct from new.status)
  execute function billing.invoices_stock_effect();

create or replace function billing.purchase_bills_stock_effect()
returns trigger
language plpgsql
security definer
set search_path = billing, public
as $$
declare v_item record;
begin
  if old.status = 'draft' and new.status not in ('draft', 'void') then
    for v_item in
      select pbi.item_id, pbi.quantity from billing.purchase_bill_items pbi
      join billing.items i on i.id = pbi.item_id
      where pbi.purchase_bill_id = new.id and i.track_inventory = true
    loop
      if new.warehouse_id is null then
        raise exception 'Purchase bill % has stock-tracked items but no warehouse_id set', new.id;
      end if;
      insert into billing.stock_movements (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, v_item.quantity, 'purchase', 'purchase_bill', new.id);
    end loop;
  elsif old.status not in ('draft', 'void') and new.status = 'void' then
    for v_item in
      select pbi.item_id, pbi.quantity from billing.purchase_bill_items pbi
      join billing.items i on i.id = pbi.item_id
      where pbi.purchase_bill_id = new.id and i.track_inventory = true
    loop
      insert into billing.stock_movements (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, -v_item.quantity, 'purchase_void', 'purchase_bill', new.id);
    end loop;
  end if;
  return new;
end;
$$;
create trigger purchase_bills_stock_effect after update of status on billing.purchase_bills
  for each row when (old.status is distinct from new.status)
  execute function billing.purchase_bills_stock_effect();

create or replace function billing.credit_notes_stock_effect()
returns trigger
language plpgsql
security definer
set search_path = billing, public
as $$
declare v_item record;
begin
  if old.status = 'draft' and new.status = 'issued' then
    for v_item in
      select cni.item_id, cni.quantity from billing.credit_note_items cni
      join billing.items i on i.id = cni.item_id
      where cni.credit_note_id = new.id and i.track_inventory = true
    loop
      if new.warehouse_id is null then
        raise exception 'Credit note % has stock-tracked items but no warehouse_id set', new.id;
      end if;
      insert into billing.stock_movements (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, v_item.quantity, 'sales_return', 'credit_note', new.id);
    end loop;
  elsif old.status = 'issued' and new.status = 'void' then
    for v_item in
      select cni.item_id, cni.quantity from billing.credit_note_items cni
      join billing.items i on i.id = cni.item_id
      where cni.credit_note_id = new.id and i.track_inventory = true
    loop
      insert into billing.stock_movements (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, -v_item.quantity, 'sales_return_void', 'credit_note', new.id);
    end loop;
  end if;
  return new;
end;
$$;
create trigger credit_notes_stock_effect after update of status on billing.credit_notes
  for each row when (old.status is distinct from new.status)
  execute function billing.credit_notes_stock_effect();

create or replace function billing.debit_notes_stock_effect()
returns trigger
language plpgsql
security definer
set search_path = billing, public
as $$
declare v_item record;
begin
  if old.status = 'draft' and new.status = 'issued' then
    for v_item in
      select dni.item_id, dni.quantity from billing.debit_note_items dni
      join billing.items i on i.id = dni.item_id
      where dni.debit_note_id = new.id and i.track_inventory = true
    loop
      if new.warehouse_id is null then
        raise exception 'Debit note % has stock-tracked items but no warehouse_id set', new.id;
      end if;
      insert into billing.stock_movements (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, -v_item.quantity, 'purchase_return', 'debit_note', new.id);
    end loop;
  elsif old.status = 'issued' and new.status = 'void' then
    for v_item in
      select dni.item_id, dni.quantity from billing.debit_note_items dni
      join billing.items i on i.id = dni.item_id
      where dni.debit_note_id = new.id and i.track_inventory = true
    loop
      insert into billing.stock_movements (org_id, item_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id)
        values (new.org_id, v_item.item_id, new.warehouse_id, v_item.quantity, 'purchase_return_void', 'debit_note', new.id);
    end loop;
  end if;
  return new;
end;
$$;
create trigger debit_notes_stock_effect after update of status on billing.debit_notes
  for each row when (old.status is distinct from new.status)
  execute function billing.debit_notes_stock_effect();

-- ----------------------------------------------------------------------------
-- Organization provisioning is superadmin-only — see 003's
-- organizations_insert policy (with check (billing.is_superadmin())).
-- There is deliberately no auto-provisioning trigger on auth.users here
-- anymore: signing up no longer hands a user their own org for free. The
-- superadmin creates the org (insert into billing.organizations), then
-- adds whoever should belong to it (insert into billing.memberships —
-- billing.is_org_admin() passes for a superadmin against any org, so that
-- insert is already allowed by the existing memberships_insert policy,
-- nothing new needed there). If you want self-serve signup back later,
-- this is the file to reintroduce a handle_new_user()-style trigger in.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Only a superadmin may flip organizations.is_active. Everything else on
-- the row (name, GST/PDF settings, prefixes, business_type_id...) stays
-- governed by the ordinary organizations_update RLS policy in 003 — this
-- trigger only guards this one column.
-- ----------------------------------------------------------------------------
create or replace function billing.check_organization_active_change()
returns trigger language plpgsql set search_path = billing, public as $$
begin
  if old.is_active is distinct from new.is_active and not billing.is_superadmin() then
    raise exception 'Organization % — only a superadmin can change is_active', old.id;
  end if;
  return new;
end;
$$;
create trigger organizations_active_change_guard before update of is_active on billing.organizations
  for each row when (old.is_active is distinct from new.is_active)
  execute function billing.check_organization_active_change();

-- ----------------------------------------------------------------------------
-- Same guard, same reasoning, for the new base-plan billing state. Only a
-- superadmin may flip subscription_status — an org can never pay itself
-- into 'active' by writing the column directly. Later, once a real payment
-- gateway exists, a webhook (running as service_role, which bypasses this
-- trigger the same way superadmin does) would call this instead of a human.
-- ----------------------------------------------------------------------------
create or replace function billing.check_organization_subscription_change()
returns trigger language plpgsql set search_path = billing, public as $$
begin
  if old.subscription_status is distinct from new.subscription_status and not billing.is_superadmin() then
    raise exception 'Organization % — only a superadmin can change subscription_status', old.id;
  end if;
  return new;
end;
$$;
create trigger organizations_subscription_change_guard before update of subscription_status on billing.organizations
  for each row when (old.subscription_status is distinct from new.subscription_status)
  execute function billing.check_organization_subscription_change();
