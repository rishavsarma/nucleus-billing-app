-- ============================================================================
-- 013 — memberships.is_active: instant user-ban enforced at the RLS layer
-- ============================================================================
-- Problem: the app caches the resolved auth identity (userId, orgId,
-- isSuperadmin) in Redis for 60 s to avoid a Supabase Auth round-trip on
-- every request. An org admin banning a user via the API would not take
-- effect until that cache entry expires.
--
-- Fix: add is_active to billing.memberships and fold it into
-- is_org_member() / is_org_admin(). Because RLS runs on EVERY database
-- query using the real JWT (never our cached value), setting
-- is_active = false on a membership row immediately blocks all data access
-- for that user regardless of what our app cache says. The ban lands the
-- moment the UPDATE reaches Postgres — no cache-busting required.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Column
-- ----------------------------------------------------------------------------
alter table billing.memberships
  add column if not exists is_active boolean not null default true;

comment on column billing.memberships.is_active is
  'When false the member is suspended from this org. All RLS policies deny '
  'access instantly via is_org_member()/is_org_admin() — no app-cache '
  'invalidation needed. Owners cannot deactivate their own membership '
  '(enforced by the membership_owner_cannot_self_deactivate trigger below).';

-- ----------------------------------------------------------------------------
-- 2. Index — is_org_member() / is_org_admin() filter on this column on every
--    request; without an index that is a sequential scan on memberships.
-- ----------------------------------------------------------------------------
create index if not exists memberships_user_org_active_idx
  on billing.memberships (user_id, org_id, is_active);

-- ----------------------------------------------------------------------------
-- 3. Update helper functions
-- ----------------------------------------------------------------------------

-- is_org_member: add "and m.is_active" alongside the existing org checks.
create or replace function billing.is_org_member(p_org_id uuid)
returns boolean language sql stable security definer set search_path = billing, public as $$
  select billing.is_superadmin() or exists (
    select 1 from billing.memberships m
    join billing.organizations o on o.id = m.org_id
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.is_active
      and o.is_active
      and o.subscription_status in ('trialing', 'active')
  );
$$;

-- is_org_admin: same addition.
create or replace function billing.is_org_admin(p_org_id uuid)
returns boolean language sql stable security definer set search_path = billing, public as $$
  select billing.is_superadmin() or exists (
    select 1 from billing.memberships m
    join billing.organizations o on o.id = m.org_id
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.is_active
      and m.role in ('owner', 'admin')
      and o.is_active
      and o.subscription_status in ('trialing', 'active')
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. Safety trigger — an owner cannot deactivate their own membership.
--    Without this, an owner could accidentally lock themselves (and everyone
--    else if they are the only admin) out of the org permanently via the API.
--    Superadmins are still free to do it directly in the DB/service_role.
-- ----------------------------------------------------------------------------
create or replace function billing.membership_owner_cannot_self_deactivate()
returns trigger language plpgsql security definer set search_path = billing, public as $$
begin
  -- Only relevant when is_active is being flipped to false.
  if new.is_active = false and old.is_active = true then
    -- Block if the target member is an owner deactivating themselves.
    if new.user_id = auth.uid() and new.role = 'owner' then
      raise exception
        'An owner cannot deactivate their own membership. '
        'Transfer ownership first or ask a superadmin to do this.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists membership_owner_cannot_self_deactivate
  on billing.memberships;

create trigger membership_owner_cannot_self_deactivate
  before update of is_active on billing.memberships
  for each row execute function billing.membership_owner_cannot_self_deactivate();

-- ----------------------------------------------------------------------------
-- 5. RLS policy note — memberships_update already allows org admins to
--    update rows (via is_org_admin). The trigger above is what constrains
--    which updates are legal within that permission. No policy change needed.
-- ----------------------------------------------------------------------------
