-- ============================================================================
-- nucleus-billing — staff roster + membership seat limit
--
-- Two unrelated additions bundled in one patch since both touch the
-- "people in an org" surface:
--
-- 1. Generalizes billing.delivery_persons (added in 006_item_variants.sql's
--    era, db-schema/005) into billing.staff — a record-only roster of
--    people with no login (delivery persons, movers, etc.), as opposed to
--    billing.memberships which are real Supabase-authenticated users. A
--    rename-in-place, not a new table: delivery duty is now just
--    role = 'delivery_person' on the general staff roster, so
--    billing.deliveries.delivery_person_id keeps working unchanged (FKs
--    track the referenced table by OID, not name, so the rename doesn't
--    disturb it).
--
-- 2. Caps billing.memberships at 3 rows per org_id — a flat, hardcoded
--    limit for now (not a per-plan configurable value; revisit if/when
--    subscription tiers need different seat counts). Enforced by a
--    before-insert trigger so it holds regardless of which path creates
--    the row (the app's own POST, or a manual SQL insert).
--
-- Data note: safe to run pre-launch with test data only, same reasoning as
-- 010_returns_split.sql. This rename is additive-safe in the sense that no
-- destructive DDL against a column with real history is involved (unlike
-- 010's table renames, this one carries no complex trigger logic to
-- reproduce) — it's a straightforward ALTER TABLE + new columns.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Generalize delivery_persons -> staff.
-- ----------------------------------------------------------------------------
alter table billing.delivery_persons rename to staff;
alter index billing.delivery_persons_org_id_idx rename to staff_org_id_idx;

alter table billing.staff add column role text not null default 'delivery_person'
  check (role in ('delivery_person', 'mover', 'other'));
-- Only meaningful when role = 'other' — a free-text label so "other" stays
-- useful instead of a dead end (e.g. "Warehouse helper", "Cleaner").
alter table billing.staff add column role_label text;

comment on table billing.staff is 'Record-only roster of people with no login (delivery persons, movers, etc.) — distinct from billing.memberships, which are real authenticated users.';

drop policy if exists delivery_persons_select on billing.staff;
drop policy if exists delivery_persons_insert on billing.staff;
drop policy if exists delivery_persons_update on billing.staff;
drop policy if exists delivery_persons_delete on billing.staff;
create policy staff_select on billing.staff for select using (billing.is_org_member(org_id));
create policy staff_insert on billing.staff for insert with check (billing.is_org_member(org_id));
create policy staff_update on billing.staff for update using (billing.is_org_member(org_id));
create policy staff_delete on billing.staff for delete using (billing.is_org_member(org_id));

-- billing.deliveries.delivery_person_id needs no change at all — the FK
-- constraint follows the renamed table automatically, and the column still
-- means exactly what it did: "which staff row (now always role =
-- 'delivery_person' by convention, not by constraint) is assigned."

-- ----------------------------------------------------------------------------
-- 2. Cap billing.memberships at 3 rows per org — hardcoded for now.
-- ----------------------------------------------------------------------------
create or replace function billing.check_membership_limit()
returns trigger
language plpgsql
set search_path = billing, public
as $$
declare
  v_count int;
begin
  select count(*) into v_count from billing.memberships where org_id = new.org_id;
  if v_count >= 3 then
    raise exception 'membership_limit_reached: organization % already has % members (limit 3)', new.org_id, v_count
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_limit_guard on billing.memberships;
create trigger memberships_limit_guard before insert on billing.memberships
  for each row execute function billing.check_membership_limit();
