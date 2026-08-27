-- ============================================================================
-- nucleus-billing — date-range PDF watermark presets patch
-- Safe to run standalone against a database that already has 001-008
-- applied — one new table only, nothing here touches existing data.
--
-- organizations.pdf_watermark_text (existing since the original schema) is
-- left untouched and still works as a permanent, manually-toggled fallback
-- (e.g. a standing "COPY" watermark) — this table adds a second, richer
-- layer on top: presets that switch themselves on/off by date range (e.g.
-- "Diwali Sale" for two weeks in October) without anyone having to
-- remember to edit/clear the flat field before and after.
-- ============================================================================

create table billing.pdf_watermarks (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references billing.organizations(id) on delete cascade,
  name       text not null,  -- internal label for the settings list, e.g. "Diwali 2026" — never printed
  text       text not null,  -- the actual text rendered on the PDF, e.g. "Diwali Dhamaka Sale"
  starts_on  date not null,
  ends_on    date not null,
  is_active  boolean not null default true,  -- manual kill switch, independent of the date range — lets someone prepare a preset ahead of time without it being live yet, or pull one early
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index pdf_watermarks_org_id_idx on billing.pdf_watermarks (org_id);
-- Powers "the currently active watermark for this org" — is_active plus
-- today falling inside [starts_on, ends_on].
create index pdf_watermarks_active_window_idx on billing.pdf_watermarks (org_id, is_active, starts_on, ends_on);

comment on table billing.pdf_watermarks is
  'Date-range watermark presets. When more than one is active for the same day, the app picks the most recently started one — overlapping ranges are a data-entry mistake, not a schema concern.';

-- RLS: ordinary org-scoped CRUD, same shape as warehouses/tax-rates — a
-- display setting, not a financial document, so normal delete is allowed
-- (no void-only restriction).
alter table billing.pdf_watermarks enable row level security;
create policy pdf_watermarks_select on billing.pdf_watermarks for select using (billing.is_org_member(org_id));
create policy pdf_watermarks_insert on billing.pdf_watermarks for insert with check (billing.is_org_member(org_id));
create policy pdf_watermarks_update on billing.pdf_watermarks for update using (billing.is_org_member(org_id));
create policy pdf_watermarks_delete on billing.pdf_watermarks for delete using (billing.is_org_member(org_id));

-- 004_grants.sql's `alter default privileges` already covers this new
-- table automatically — no grants file changes needed.
