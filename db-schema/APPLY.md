# Applying the v3 schema (Base subscription gating, Business types, Add-on marketplace, Sales, Purchases, Customers/Vendors, full Inventory, Offers, Settings)

This supersedes v2 (which had Sales/Purchases/Inventory/Offers but no
subscription/add-on layer) the same way v2 superseded v1 before it. There's
no real data behind v2 yet, so this is a clean rewrite, not a migration —
see "0. Starting fresh" below. Same standard as before: every table,
trigger, and RLS policy here was actually run against a real Postgres 16
instance — items, a purchase bill that received 200 units, a sale of 30, a
credit note returning 5, a 10% offer discount, cross-tenant isolation, an
org losing all access when its subscription lapses, and an org gaining a
feature the moment it's subscribed to an add-on — not just written and
hoped for.

## What's new in v3

Full design writeup is in `SYSTEM_DESIGN.md`; this is the short version of
what changed and why, in the same spirit as the "Superadmin & organization
activation" section below (a real behavior change, worth reading before you
run it, not just an addition).

- **Base subscription gating**, independent of `is_active`.
  `organizations.subscription_status` (`'trialing'` / `'active'` /
  `'past_due'` / `'cancelled'`) answers "did they pay for the base plan" —
  a separate question from `is_active`, which answers "did a superadmin
  ban them." Both are required by `is_org_member()`/`is_org_admin()` now,
  so an org that's `past_due` or `cancelled` loses access to *everything*,
  the same way a deactivated org does — no per-table changes needed, since
  every table already routes through those two functions. Only a
  superadmin can change `subscription_status` (new guard trigger, same
  shape as the existing `is_active` guard). New orgs default to
  `'trialing'`.
- **Business types.** `billing.business_types` is a small catalog
  (Retail/General Store, Pharmacy, Restaurant/Food Service,
  Distributor/Wholesaler, Services — seed data below) an org picks from at
  onboarding via the new `organizations.business_type_id`. Purely
  advisory/UX — nothing reads it for access control.
- **Add-on marketplace.** `billing.addons` is the purchasable catalog;
  `billing.organization_addon_subscriptions` is the actual entitlement —
  one active row per org+addon, cancelled rows kept for history. Writes
  only happen through two new functions,
  `billing.subscribe_org_to_addon(org_id, addon_slug)` and
  `billing.cancel_org_addon(org_id, addon_slug)`, both superadmin-only (no
  payment gateway is wired up yet, so this is a manual step — the schema is
  shaped so a webhook can call the same functions later without a
  redesign). `billing.business_type_addon_recommendations` is a third,
  purely advisory table for the onboarding screen ("as a pharmacy you'll
  probably want X"). The actual enforcement choke point for any future
  add-on-gated feature is `billing.org_has_addon(org_id, addon_slug)` —
  combine it with `is_org_member()` the same way every existing table
  combines `is_org_member()` with its own `org_id` check.

One thing left as a deliberate simplification, not an oversight:
`min_commitment_until` on `organization_addon_subscriptions` is
informational only in this version — shown to the UI, not enforced by a
state machine that blocks early cancellation. There's no real payment
collection to reconcile against yet, so building that enforcement now
would be guessing at requirements a real billing integration will actually
dictate later.

## Hardening pass (post-independent-review)

After the first version of this schema, it was put through an adversarial
review looking specifically for ways it could be broken or exploited —
not just "does the happy path work." That review found real gaps, all of
which are now closed and covered by regression tests:

- **Confirmed documents could be pushed back to `'draft'` and re-confirmed**,
  double-firing the stock deduction/increase. Closed: a status-transition
  guard now rejects any move back to `draft` once a document has left it,
  and rejects any change at all to a `void` document (void is terminal).
- **`'paid'`/`'partially_paid'` could be typed directly** onto an invoice or
  bill regardless of whether any money was actually recorded — a staff
  member (or a bug) could mark something paid that wasn't. Closed: those
  statuses can now only be reached by `recalc_invoice()`/
  `recalc_purchase_bill()` deriving them from actual payment rows; a direct
  write is rejected.
- **Any org member could permanently `DELETE` an invoice, bill, credit
  note, debit note, or payment** — wiping real financial history with no
  trace. Closed: there is no longer a delete policy on any of these six
  tables at all. Cancelling a document is done by setting
  `status = 'void'`, never by deleting the row.
- **Line items could still be edited or deleted after a document was
  confirmed**, silently changing a "sent" invoice's total (and drifting it
  away from what the stock ledger actually recorded). Closed: line items on
  `invoice_items`/`purchase_bill_items`/`credit_note_items`/
  `debit_note_items` are now locked the moment their parent leaves `draft`
  — void and reissue instead of editing in place.
- **A payment could be recorded against a `draft` or `void` document**,
  leaving `amount_paid` carrying a balance the document's own status
  disowned. Closed: both payment tables now reject inserts against a
  parent that isn't actually confirmed.
- **A credit/debit note could return more units than were ever sold/bought**
  on the line it referenced. Closed: return quantity is now checked against
  the original line's quantity minus whatever's already been returned
  against it (only when linked back via `invoice_item_id`/
  `purchase_bill_item_id` — an unlinked, free-form return line is
  unaffected, same as before).
- **An expired or deactivated offer kept discounting invoices forever** —
  `starts_at`/`ends_at`/`is_active` were stored but never actually checked.
  Closed: `recalc_invoice()` now only applies the discount when the offer
  is active and within its date window; otherwise `discount_total` is `0`.
- **A client could insert a fabricated `'sale'`/`'purchase'` row directly
  into `stock_movements`**, moving stock with no invoice or bill behind it
  at all. Closed: direct inserts by ordinary members are now restricted to
  `movement_type = 'adjustment'` only — the real movement types are written
  exclusively by the (`SECURITY DEFINER`) trigger functions that fire off
  an actual document's status change.
- **Two concurrent writes to the same invoice/bill** (e.g. two payments
  landing at once) could race — the second recalculation could compute its
  sum before the first one committed, silently overwriting it with a stale
  total. Closed: every `recalc_*` function now takes a row lock on its
  parent document before aggregating, so concurrent recalculations
  serialize instead of racing.
- **`stock_movements` had no record of who made a manual adjustment.**
  Closed: added a `created_by` column that defaults to `auth.uid()`, so
  every stock correction is automatically attributed to the session that
  made it.

- **The Supabase linter flags `function_search_path_mutable`** on any
  function that doesn't pin its own `search_path` — without it, a function
  resolves unqualified names against whatever `search_path` the calling
  session happens to have, which is a known privilege-escalation vector if
  someone can ever influence that session's search_path. Closed: every
  function in `002_functions_triggers.sql` now explicitly sets
  `search_path = billing, public` (the trigger functions that call
  `recalc_*()`, the status-transition guards, the item-lock/quantity-guard
  triggers — all of it). This is on top of the six functions that already
  had it from the first version (`stock_movements_apply`,
  `handle_new_user`, and the four `*_stock_effect()` functions). None of
  these needed to become `SECURITY DEFINER` to fix the warning — they run
  fine as ordinary invoker functions under RLS; only `search_path` was
  missing.

One thing deliberately left as a judgment call rather than silently
decided: **nothing stops `item_stock.quantity_on_hand` from going
negative** (overselling). Some shops want that blocked outright; others
rely on it for backorders/pre-orders. If you want it hard-blocked, add
`check (quantity_on_hand >= 0)` to `billing.item_stock` — say the word and
it's a one-line change, but it wasn't added by default since it's a real
business-policy choice, not an obvious bug.

## Superadmin & organization activation

This is a real change of behavior, not just an addition, so it's worth
reading before you run it.

**What's new:**

- **`billing.superadmins`** — a table of `auth.users` ids. Anyone in it
  can see and write every organization's data, across every tenant — the
  two RLS helper functions almost everything else is built on
  (`is_org_member()` / `is_org_admin()`) now pass for a superadmin against
  *any* `org_id`, without touching the ~55 individual policies on the other
  20 tables.
- **Only a superadmin can create an organization.** There's a real
  `organizations_insert` RLS policy now (there wasn't one before — the
  only path to a new org was the signup trigger), and it requires
  `is_superadmin()`.
- **`organizations.is_active`** (new column, defaults `true`) — and only a
  superadmin can change it. A dedicated trigger
  (`check_organization_active_change`) blocks anyone else from touching
  that one column, even an org's own owner. Flip it to `false` and that
  org's own members lose access to *everything* scoped to their org —
  customers, invoices, stock, all of it — immediately, because
  `is_org_member()`/`is_org_admin()` now require the org to be active for
  anyone who isn't a superadmin. A superadmin can still see and reactivate
  a deactivated org, since their bypass doesn't check `is_active` at all.
- **Signup no longer auto-creates an organization.** The old
  `handle_new_user()` trigger on `auth.users` — the one that gave every
  new signup their own org for free — is gone. Provisioning a new shop is
  now two steps a superadmin does: insert the org, then insert a
  `billing.memberships` row linking the person's `auth.users` id to it
  (that second insert already works with no changes, since
  `is_org_admin()` now passes for a superadmin against any org).

**Granting superadmin status is deliberately not exposed through the API
at all** — there's no insert policy on `billing.superadmins`, on purpose.
It's a manual step in the SQL editor:

```sql
insert into billing.superadmins (user_id)
select id from auth.users where email = 'you@example.com';
```

Run that once for whichever account should be the superadmin, after
applying the schema.

Tested the same way as everything else here: built a fresh Postgres
database with the schema as it stood *before* this change (matching what
your live Supabase already has), applied the patch on top of it, and ran
12 scenarios against it — a non-superadmin blocked from creating an org, a
superadmin creating two orgs and adding an owner to each, both owners
staying isolated from each other's data, a superadmin seeing both orgs'
customers in one query, an org owner blocked from flipping their own
`is_active`, a superadmin deactivating an org and that org's owner losing
access immediately, the superadmin still seeing the deactivated org's data,
reactivation restoring the owner's access — all 12 passed. Then reran the
original purchase → sale → credit-note flow and all the hardening-pass
regression tests on top of the patched schema to confirm nothing else
broke — unchanged.

## 0. Starting fresh

Whatever you already ran — v1, v2, or nothing — there's no real data in
any of it yet, so the clean move is to drop and start fresh rather than
write forward migrations for a schema that's days old. This is what "we'll
drop the current billing schema" means concretely:

```sql
drop schema billing cascade;
```

Then proceed with the steps below as if this were the first time. There is
no separate patch file in v3 (unlike v2's `005_superadmin.sql`) — since
there's nothing live to patch around, everything ships natively in
001-003.

## 1. Run the SQL, in order

Supabase Studio → SQL Editor → paste and run each file, in this order:

1. `001_billing_schema.sql` — every table: tenancy (including business
   types and the new subscription columns), parties, catalog/inventory,
   sales, sales returns, purchases, purchase returns, offers, document
   counters, superadmins, and the add-on marketplace tables
2. `002_functions_triggers.sql` — all the logic: line-item math, invoice/
   bill/credit-note/debit-note roll-ups, the stock ledger, document
   numbering, the org-activation guard, and the new subscription-status
   guard
3. `003_rls_policies.sql` — Row Level Security on every table (including
   superadmin cross-tenant access and the new add-on-catalog/entitlement
   policies), plus the `org_has_addon()`, `subscribe_org_to_addon()`, and
   `cancel_org_addon()` functions
4. `004_grants.sql` — unchanged from before, lets PostgREST touch the
   schema at all (RLS still gates individual rows, and now subscription
   status too)

One-time initial migration, not idempotent — don't re-run `001` against a
database that already has these tables.

## 1b. Seed the new catalogs

Nothing in the app works with an empty `business_types`/`addons` catalog —
seed at least the business types after applying 001-004:

```sql
insert into billing.business_types (name, slug, description) values
  ('Retail / General Store', 'retail', 'General retail and kirana stores'),
  ('Pharmacy', 'pharmacy', 'Medical & pharmacy stores'),
  ('Restaurant / Food Service', 'restaurant', 'Restaurants, cafes, food outlets'),
  ('Distributor / Wholesaler', 'distributor', 'Bulk distribution and wholesale'),
  ('Services', 'services', 'Service-based businesses, no physical inventory');
```

Add-ons are seeded per-add-on as you actually build each one (there's
deliberately no starter add-on seeded here — see SYSTEM_DESIGN.md, the
e-way bill example is still an open question on scope, not something to
seed blind). When you do add one:

```sql
insert into billing.addons (name, slug, description, price, min_commitment_days)
values ('Example Add-on', 'example-addon', 'What it does', 200.00, 30);

-- then, per org:
select billing.subscribe_org_to_addon('<org_id>', 'example-addon');
```

## 2. Same PGRST_DB_SCHEMAS / supabase-js / type-gen steps as before

Nothing changed here from the v1 instructions — if you already did this
for v1's `billing` schema, there's nothing more to do:

- `PGRST_DB_SCHEMAS` on the `rest` container must include `billing`
  (append, don't replace — keep `storage` etc.)
- Point supabase-js at it: `supabase.schema("billing").from(...)` or
  `{ db: { schema: "billing" } }` on the client
- `supabase gen types typescript --schema public,billing > lib/database.types.ts`

## 3. How the pieces fit together

**Tenancy is now superadmin-provisioned, not self-serve.** Signing up no
longer hands a new user their own org — a superadmin creates the
organization and adds people to it via `billing.memberships`. Everything
else is still scoped to that org via RLS, and a superadmin additionally
sees and manages every org's data, not just their own. See "Superadmin &
organization activation" above.

**Items** (`billing.items`) replace what was called `products` in v1 —
same idea, now with `sku`, `hsn_sac_code` (GST), `unit`, `reorder_level`,
and `track_inventory`. A service you sell but don't stock (consulting,
labour) is just an item with `track_inventory = false` — it never touches
the stock ledger.

**Inventory is multi-warehouse.** `billing.warehouses` is your list of
locations/godowns. `billing.item_stock` is the current quantity-on-hand per
item per warehouse — always derived, never written directly. The actual
source of truth is `billing.stock_movements`, an **append-only ledger**
(enforced by a trigger — UPDATE/DELETE always fail, even for the service
role; corrections are offsetting rows). Every stock change you'll ever want
to report on (what sold, what was returned, what was received) is a row in
that table.

**Stock only moves when a document is confirmed, not while it's a draft.**
Concretely: an invoice, purchase bill, credit note, or debit note only
touches `stock_movements` the moment its `status` leaves `'draft'` for the
first time (`sent`/`received`/`issued`), and reverses if it's later voided.
Editing line items *after* that point does **not** retroactively adjust
stock in this version — if you need to fix a confirmed document, void it
and create a new one rather than editing it in place. This is the same
tradeoff most invoicing software makes; building live stock-diffing on
every edit is a lot of extra trigger complexity for a case (correcting an
already-sent invoice) that's better handled as void + reissue anyway.

**Sales = invoices**, same as before — now with `item_id` on line items
(instead of the old `product_id`), a `warehouse_id` (required once any
tracked item is on it — the trigger will raise an error if you try to
confirm an invoice with a tracked item and no warehouse set), and an
optional `offer_id` + auto-computed `discount_total`.

**Purchases = a single Bill**, per what you picked — no separate Purchase
Order stage. Record the vendor + items + cost when goods arrive
(`billing.purchase_bills` / `purchase_bill_items`), track what you've paid
them (`purchase_payments`). Status flow mirrors invoices: `draft` →
`received` → `partially_paid`/`paid`, or `void`. If you want a PO stage
later, it's additive — a new `purchase_orders` table with a `po_id` on
`purchase_bills`, not a rework of what's here.

**Returns.** `credit_notes` (customer returns something, referencing the
original invoice, restocking on issue) and `debit_notes` (you return
something to a vendor, referencing the original bill, destocking on issue)
are both real documents with their own numbering, not just adjustments
bolted onto the original invoice/bill. Deliberately **not** wired to
automatically reduce the original invoice/bill's `amount_paid` or `total`
— that's a real accounting judgment call (refund vs. credit against a
future invoice vs. write-off) that belongs in the app layer, not silently
decided by a trigger.

**Offers** are named, dated discount schemes (`billing.offers`) — percentage
or flat, optionally scoped to specific items via `offer_items`. Attach one
to an invoice via `invoices.offer_id` and `discount_total` computes
automatically. Note: the database does **not** enforce that an offer
scoped to specific items is only used on invoices containing those items —
that's a UI-level concern (only show applicable offers), same as date
validity (`starts_at`/`ends_at` are informational for the app to filter by,
not enforced at write time).

**Settings** (GST, PDF, prefixes) live directly on `billing.organizations`
rather than a separate settings table, since there's exactly one settings
row per org anyway:

| Column | Purpose |
|---|---|
| `gstin`, `gst_registered`, `state_code` | GST registration + place of supply |
| `pdf_watermark_text` | e.g. `"COPY"` / `"PAID"` — null = no watermark |
| `pdf_logo_url`, `pdf_footer_notes` | Invoice/bill PDF branding & default terms |
| `invoice_prefix`, `bill_prefix`, `credit_note_prefix`, `debit_note_prefix` | Document numbering prefixes, independently configurable |
| `financial_year_start_month` | Defaults to `4` (April, matching the Indian FY) |
| `low_stock_alerts_enabled` | For the app to decide whether to surface reorder-level warnings |

`is_active` isn't in this table on purpose — it's an access-control switch
a superadmin flips to suspend a shop, not a display setting an org's own
admin can touch, so it's covered in "Superadmin & organization activation"
above instead.

## 4. Sanity check after applying

1. Grant yourself superadmin (see above), then insert a test organization
   and a test `auth.users` account, and link them with a
   `billing.memberships` row (`role = 'owner'`) — all as the superadmin.
   Confirm a second, non-superadmin test account gets rejected if it tries
   to insert an organization directly.
2. As the test owner, create a warehouse, an item with
   `track_inventory = true`, and a vendor.
3. Create a purchase bill for that vendor/item/warehouse, add a line item,
   then set `status = 'received'`. Confirm `billing.item_stock` now shows
   the quantity, and `billing.stock_movements` has a `'purchase'` row.
4. Create an invoice for that item from the same warehouse, set
   `status = 'sent'`. Confirm stock decreased and a `'sale'` row appeared.
5. Try setting an invoice's status to `'sent'` with `warehouse_id` left
   null while it has a tracked item on it — confirm it's rejected with the
   "has stock-tracked items but no warehouse_id set" error.
6. Create a second test org (as superadmin) with its own owner, confirm
   the two owners see zero rows for each other's data — RLS doing its job
   across the new tables too.
7. As the superadmin, confirm you can see both test orgs' data in one
   query. Then set one org's `is_active = false` and confirm that org's
   owner immediately loses access, while you (superadmin) still see it.
   Set it back to `true` and confirm the owner regains access.
8. Set that same org's `subscription_status = 'past_due'` and confirm its
   owner loses access the same way as step 7, independently of
   `is_active` — then set it back to `'active'` and confirm access
   returns. Confirm the owner themselves gets rejected if they try to
   change their own `subscription_status` directly.
9. Seed one test add-on and run `select billing.subscribe_org_to_addon(...)`
   for the test org; confirm `billing.org_has_addon(org_id, 'the-slug')`
   returns true for that org and false for the second test org. Confirm a
   non-superadmin test account gets rejected calling
   `subscribe_org_to_addon`/`cancel_org_addon` directly. Then call
   `cancel_org_addon` and confirm `org_has_addon` flips back to false while
   the cancelled row still exists with `status = 'cancelled'`.

## What's deliberately not in this version

- **GST return-ready numbering/reporting** (FY-reset formats, CGST/SGST/IGST
  split, GSTR-1/3B exports) — HSN/SAC codes and a flat tax rate are in
  place as building blocks, but compliance-grade GST reporting is a
  meaningfully bigger scope. Flag it if you need it before Oct 31.
- **Purchase Orders as a separate pre-Bill stage** — you picked single
  Bill; the note above covers how to add a PO stage later without rework.
- **Stock adjustments/write-offs as their own document** — `'adjustment'`
  exists as a `stock_movements.movement_type` so you can insert one
  directly (e.g. for a stocktake correction), but there's no dedicated
  "Stock Adjustment" table/UI concept yet — just the raw ledger entry.
  Worth adding once you actually need a stocktake workflow.
- **Recurring invoices / subscriptions** — not modeled, out of scope until
  asked for.
- **Role-gated writes beyond org-level settings** — same as v1: any org
  member can create/edit sales, purchases, items, etc. Only renaming the
  org and managing memberships is owner/admin-only.
- **Razorpay** — `payments.method` already has `'razorpay'` with a
  `reference` column for the gateway payment id; purchase-side payments
  intentionally don't, since you don't take Razorpay payments *from*
  vendors.
- **Invoice compliance columns** (`po_number`, `eway_bill_number`,
  `vehicle_number`) — deferred until it's decided whether "e-way bill
  add-on" means manual data-entry fields (essentially free) or the app
  actually generating a real e-way bill via a GSP/NIC API integration
  (real per-document cost, which is what would justify gating it behind a
  paid add-on). Not part of v3.
- **Real payment gateway integration for the base plan / add-ons** —
  `subscription_status` and `organization_addon_subscriptions` are both
  manually driven by a superadmin for now. The schema is shaped so a
  payment webhook (running as `service_role`) can call
  `subscribe_org_to_addon()`/`cancel_org_addon()` and update
  `subscription_status` later without a redesign, but nothing calls them
  automatically yet.
- **A grace period on `past_due`** — right now `past_due` locks an org out
  immediately, the same as `cancelled` (only `'trialing'`/`'active'` pass
  `is_org_member()`/`is_org_admin()`). Most subscription products give a
  `past_due` account a few days before hard-locking it, but that's a
  dunning workflow that only makes sense once real payment collection
  exists to actually retry against — not simulated here.
- **Independent add-on billing cycles** — every add-on renews on the org's
  base-plan cycle (`organization_addon_subscriptions.renews_at` is synced
  to `organizations.subscription_current_period_end`), not on its own
  independent date. Simpler to reconcile for now; revisit if a real add-on
  ever needs its own cycle.
- **Multi-vertical schema** (real estate, etc.) — not built. The add-on
  framework here (catalog table + org entitlement table + slug-based
  checks) is deliberately generic so a future vertical module can reuse
  the same mechanism instead of needing its own — see SYSTEM_DESIGN.md §9.
