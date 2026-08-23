-- ============================================================================
-- nucleus-billing — grants for PostgREST exposure
-- Custom schemas don't inherit the default privileges `public` gets, so
-- without this, every request comes back "permission denied for schema
-- billing" even after PGRST_DB_SCHEMAS is updated (see APPLY.md).
-- RLS (003_rls_policies.sql) is still what actually restricts row access —
-- these grants just let the anon/authenticated Postgres roles touch the
-- schema and tables at all.
-- ============================================================================

grant usage on schema billing to anon, authenticated, service_role;

grant all on all tables in schema billing to anon, authenticated, service_role;
grant all on all sequences in schema billing to anon, authenticated, service_role;
grant all on all functions in schema billing to anon, authenticated, service_role;

-- So tables/functions created *after* this script (future migrations) are
-- automatically grantable too, without re-running this file.
alter default privileges in schema billing
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema billing
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema billing
  grant all on functions to anon, authenticated, service_role;
