# Nucleus Billing — rules for working in this codebase

This file is project context for Claude Code (or any agent) building the
application layer on top of the `billing` Postgres/Supabase schema in this
folder. The schema is applied and live — read this before writing queries,
API routes, or migrations against it. Full reasoning lives in
`SYSTEM_DESIGN.md` and `PROJECT_SUMMARY.md`; this file is the condensed,
enforceable version: what not to do, and why, so mistakes don't have to be
rediscovered by hitting an RLS rejection in production.

## 0. Files in this folder

- `001_billing_schema.sql` / `002_functions_triggers.sql` /
  `003_rls_policies.sql` / `004_grants.sql` — the base schema, in apply
  order. Not idempotent, not a migration chain — see `APPLY.md` §0 before
  ever re-running `001` against a database that already has these tables.
- `005_delivery_and_public_pricing.sql` — standalone patch, safe to run
  any time after 001-004. Same convention any future patch should follow:
  additive only, `drop policy if exists` / `create table` guarded, no
  rewrite of the base files.
- `schema_structure.csv` — full field-by-field reference (table, column,
  type, nullability, default, FK, check constraint, notes). Check this
  before guessing a column name or constraint.
- `SYSTEM_DESIGN.md` — the access-control model and why it's shaped this
  way. `PROJECT_SUMMARY.md` — plain-language capability recap.
- `APPLY.md` — install steps, the tested scenario list, and the full
  hardening-pass changelog (what was broken before, what closed it).

Never treat this schema as a blank slate to redesign around app
convenience — it's been through an adversarial review and 20+ tested
scenarios. If something here seems awkward, assume there's a reason (check
`SYSTEM_DESIGN.md`/`APPLY.md` first) before proposing a schema change.

## 1. The three access gates — never bypass, never duplicate

Every table is reachable only via `billing.is_org_member(org_id)` /
`billing.is_org_admin(org_id)`, which compose three independent checks:
superadmin bypass, `organizations.is_active` (ban switch), and
`organizations.subscription_status` (`trialing`/`active` pass;
`past_due`/`cancelled` do not). Add-on-gated features additionally require
`billing.org_has_addon(org_id, 'slug')`.

- **Never write a new RLS policy that re-implements these checks inline.**
  Always call `is_org_member()` / `is_org_admin()` / `org_has_addon()` —
  that's the whole point of routing every table through them; a hand-rolled
  `org_id = (select org_id from memberships where user_id = auth.uid())`
  policy silently skips the ban/subscription/addon gates.
- **Never expose a way for app code (or a client) to set
  `organizations.is_active` or `organizations.subscription_status`
  directly.** Both are guarded by triggers that reject non-superadmin
  writes — the API layer should not try to work around this by writing
  through `service_role`; the guard trigger blocks that too by design
  (superadmin means "row in `billing.superadmins`", not "elevated
  Postgres role"). Route subscription/plan changes through a payment
  webhook calling the same guarded path a superadmin would use.
- **Never grant `billing.superadmins` inserts through the API.** There is
  no insert policy on that table on purpose — it's a manual SQL step
  (`APPLY.md` has the exact statement). If a feature seems to need "grant
  superadmin", that's a sign the feature should use `is_org_admin()`
  (org-level) instead.
- **New add-on-gated feature?** Combine `is_org_member(org_id)` with
  `org_has_addon(org_id, 'your-slug')` in the `using`/`with check` clause,
  the same way `SYSTEM_DESIGN.md` §6 shows. Don't invent a separate
  entitlement mechanism.

## 2. Financial documents (invoices, purchase bills, credit notes, debit
notes, payments, purchase payments) — a stricter subset of rules

These six tables got a dedicated hardening pass (`APPLY.md` — "Hardening
pass" section). The rules below are *enforced by triggers*, so violating
them from application code will fail loudly (good) — but the app should
never be written assuming it can route around them:

- **No delete.** There is no delete RLS policy on any of the six. To
  cancel a document, set `status = 'void'`. Never build a "delete invoice"
  button that expects a DELETE to succeed — build a "void" action instead.
- **Status can only move forward, never back to `draft`, and never out of
  `void`.** `status_transition_guard` triggers enforce this. If a user
  needs to "undo" a confirmed document, the correct flow is void + create a
  new draft, not edit-in-place.
- **`paid`/`partially_paid` are computed, not settable.** They're derived
  by `recalc_invoice()`/`recalc_purchase_bill()` from actual rows in
  `payments`/`purchase_payments`. Don't build a status dropdown that offers
  these as options — they only change as a side effect of recording a
  payment.
- **Line items lock the moment the parent leaves `draft`.** `invoice_items`
  / `purchase_bill_items` / `credit_note_items` / `debit_note_items` reject
  insert/update/delete once their parent document is confirmed
  (`lock_items_after_draft()`). The UI for a confirmed document should be
  read-only for line items — offer void + reissue instead of an edit form
  that will fail server-side.
- **A payment can't be recorded against a `draft` or `void` document** —
  `payments_guard_invoice_status()` / `purchase_payments_guard_bill_status()`
  reject it. Confirm the document first.
- **Totals (`subtotal`, `tax_total`, `discount_total`, `total`,
  `amount_paid`) are all auto-maintained.** Never write to these columns
  directly from the app — they're recalculated by trigger whenever line
  items, payments, or the linked offer change. If a total looks wrong,
  the bug is in the trigger inputs (a line item, a payment row), not
  something to patch by writing the total column.
- **Concurrent writes serialize via row lock**, not optimistic
  concurrency — `recalc_*()` takes a lock on the parent row before
  aggregating. The app doesn't need its own retry-on-conflict logic for
  "two payments landing at once"; Postgres already serializes it.

## 3. Stock — append-only, never hand-edited

- **`billing.item_stock.quantity_on_hand` is derived, never written
  directly.** It's maintained exclusively by `stock_movements_apply()`
  reacting to inserts into `billing.stock_movements`. Don't add an
  "adjust stock" feature that updates `item_stock` — insert a
  `stock_movements` row with `movement_type = 'adjustment'` instead.
- **`stock_movements` is append-only, enforced against `service_role`
  too.** UPDATE and DELETE always fail. A correction is a new offsetting
  row, never an edit. If app code needs to "undo" a manual adjustment,
  insert the inverse `quantity_delta`, don't try to modify the original
  row.
- **Ordinary members can only insert `movement_type = 'adjustment'`
  directly.** The real movement types (`purchase`, `sale`,
  `sales_return`, `purchase_return`, and their `_void` counterparts) are
  written exclusively by the `SECURITY DEFINER` `*_stock_effect()`
  trigger functions, fired by a document's status actually changing. Don't
  build an API endpoint that lets a client insert a `'sale'` movement
  directly — the only path to a sale movement is confirming an invoice.
- **Stock moves on confirm, not on draft-edit, and does not
  retroactively re-diff on a later line-item edit** (line items are locked
  post-draft anyway per §2). If a confirmed document's stock effect needs
  correcting, void it — the void reverses the movement — and create a new
  document.
- **`quantity_on_hand` is not blocked from going negative** in this
  version — that's a deliberate open policy choice (`APPLY.md`), not a
  bug. Don't "fix" overselling by adding a check constraint without
  confirming with the user first; some deployments want backorders to
  work.
- **Warehouse is required once a tracked item is involved**, enforced at
  status-change time, not at draft-save time. A form can let a draft
  invoice/bill/note sit with `warehouse_id = null` while items are
  tracked-inventory items; only confirming it triggers the "no
  warehouse_id set" error. Don't front-run this by requiring warehouse
  earlier than the schema does — differing UX is fine, but the constraint
  itself lives at confirm-time.

## 4. RLS pattern to follow for anything new

Every table added so far follows one of two shapes — match whichever
applies rather than inventing a third:

1. **Org-scoped table with its own `org_id` column** (customers, vendors,
   items, warehouses, invoices, deliveries, …): four policies, one per
   verb, each `using (billing.is_org_member(org_id))` (or
   `is_org_admin(org_id)` for the handful of owner/admin-only writes:
   memberships insert/update/delete, organizations update). Omit the
   delete policy entirely for financial documents per §2.
2. **Child table with no direct `org_id`, joined through a parent**
   (invoice_items, offer_items, credit_note_items, …): a small `stable`
   `security definer` lookup function (`billing.invoice_org_id(id)` etc.)
   that resolves the parent's `org_id`, then the same
   `is_org_member(billing.X_org_id(...))` shape. Reuse this pattern —
   don't write a subquery inline in the policy.

Catalog tables meant to be publicly or broadly readable (`business_types`,
`addons`, `business_type_addon_recommendations`) use
`for select using (true)` since `005` — public pricing calculator support.
Write access on these three stays superadmin-only
(`using (billing.is_superadmin())`). Don't loosen write access on catalog
tables without an explicit ask — public read was a deliberate, narrow
change, not a precedent for public write.

## 5. Naming and conventions to match

- Money columns: `numeric(14,2)` for document-level amounts,
  `numeric(10,2)` for addon price. Quantities: `numeric(14,4)`. Tax rates:
  `numeric(5,2)` with a `between 0 and 100` check. Match these, don't
  introduce `float`/`double precision` for anything financial.
- `created_by uuid references auth.users(id)` on every table where "who
  did this" matters; `created_at`/`updated_at timestamptz` with
  `set_updated_at()` trigger on anything mutable (not on append-only or
  catalog tables).
- Document numbering (`invoice_number`, `bill_number`, etc.) is
  trigger-assigned via `billing.next_document_number()` reading
  `org_document_counters` — never generate a document number in
  application code; leave the column null on insert and let the trigger
  fill it.
- Every `SECURITY DEFINER` function pins `search_path = billing, public`
  explicitly. Any new `SECURITY DEFINER` function must do the same
  (Supabase linter: `function_search_path_mutable` — this is a real
  privilege-escalation vector, not a style nit).
- Soft-delete via `is_active` boolean, not a `deleted_at` column, for
  catalog/reference rows that need to disappear from new-selection UI
  without breaking history (business_types, addons, delivery_persons,
  items, tax_rates' `is_default`, etc.).

## 6. Explicitly out of scope — don't build against assumptions these will
exist yet

Per `PROJECT_SUMMARY.md` §"Explicitly not in this version" and
`APPLY.md`'s "What's deliberately not in this version": no real payment
gateway wiring (subscription/addon changes are superadmin-manual), no
e-way-bill/PO-number/vehicle-number fields, no GST return-ready reporting
(GSTR-1/3B, CGST/SGST/IGST split), no dunning/grace-period on `past_due`,
no multi-vertical schema. If a task requires one of these, flag it rather
than quietly adding ad hoc columns — each has an open design question
attached (see the linked docs) that should get resolved before schema
changes, not decided implicitly by whatever the frontend needs first.

## 7. Before proposing any schema change

1. Check `schema_structure.csv` — the column/table may already exist
   under a different name than expected.
2. Check `SYSTEM_DESIGN.md` §8 and `APPLY.md`'s "deliberately not in this
   version" list — the gap may be a known, deliberately deferred decision
   rather than an oversight.
3. If genuinely new, write it as a new standalone numbered patch file
   (`006_...sql`) following `005`'s convention — additive, guarded
   (`create table if not exists` / `drop policy if exists` +
   `create policy`), never a rewrite of `001`-`004`. Note in a comment
   header what it adds and confirm it's safe to run against a database
   with real data (unlike `001`, which assumes an empty schema).
