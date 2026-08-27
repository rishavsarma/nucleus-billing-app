-- ============================================================================
-- nucleus-billing — organization invoice-header fields
-- Safe to run standalone against a database that already has 001-006
-- applied — three new nullable columns on billing.organizations, nothing
-- else. Additive only, no data touched.
--
-- What this adds:
--   PAN, a free-text postal address, and a phone/mobile number for the
--   organization — needed to print a complete seller block on an invoice
--   (GSTIN and state_code already existed from 001; this fills the rest
--   of what a physical tax invoice's letterhead needs).
-- ============================================================================

alter table billing.organizations add column pan text;
alter table billing.organizations add column address text;
alter table billing.organizations add column phone text;

comment on column billing.organizations.pan is 'PAN (Permanent Account Number) — shown on printed invoices alongside GSTIN.';
comment on column billing.organizations.address is 'Free-text postal address shown on printed invoices/bills. Single field by design — this schema doesn''t model structured street/city/pincode for the org itself, unlike customers/vendors billing_address.';
comment on column billing.organizations.phone is 'Seller contact number shown on printed invoices/bills.';
