# Nucleus Billing — Where things stand

Schema applied. This is the recap: what we did to get here, and the full
list of what the backend now actually supports.

---

## 1. What we've done

1. **Competitive research.** Toured mybillbook.in end to end — every
   document type, every settings screen, every form — and captured 48
   screenshots as the reference point for what a real Indian GST billing
   product looks like at the UI level.
2. **Gap analysis.** Compared that against the schema as it stood: found
   real gaps (no batch/expiry tracking, no PO/e-way-bill/vehicle-number
   fields, single-address parties) and real strengths (append-only stock
   ledger, status-transition guards, offer date-window enforcement — things
   mybillbook's UI didn't show any equivalent rigor for).
3. **Monetization architecture design.** Worked through a base-subscription
   (₹200/mo) + paid modular add-ons model, using e-way bill as the running
   example. Checked it against the market — nobody in India GST billing
   does this (everyone uses flat opaque tiers); Odoo's per-app pricing is
   the closest real-world precedent, applied to a different market.
4. **Access-control design.** Extended the existing `is_active`
   (superadmin ban switch) pattern with a second, independent gate —
   `subscription_status` (did they pay for the base plan) — plus a third,
   narrower one for add-ons (`org_has_addon()`). All three compose, and all
   three route through the same two functions every table already
   depended on, so nothing per-table had to change.
5. **Full schema rewrite (v3).** Rebuilt `001`–`003` from scratch with the
   new tenancy/subscription/business-type/add-on layer natively included,
   rather than patched on top. Retired `005_superadmin.sql` — its content
   is now native to `001`–`003`, no separate patch file needed since there
   was no live data to patch around.
6. **Verification.** Applied the schema to a real Postgres 16 instance and
   ran 11 scenarios end to end — subscription gating, superadmin bypass,
   the full add-on lifecycle, and a regression of the original
   purchase → sale → stock flow — before handing it over. All 11 passed.
7. **You applied it.** Schema is live.

---

## 2. What the schema supports

### Tenancy & access control
- Multi-tenant by design — every table scoped to an `org_id`, isolated by
  Row Level Security, not application-layer filtering.
- Platform superadmins who see and manage every org's data across every
  tenant, granted only via direct SQL (never through the API).
- Org creation is superadmin-provisioned, not self-serve signup.
- **Three independent access gates**, all composable:
  - `is_active` — superadmin ban switch (fraud/abuse suspension).
  - `subscription_status` (`trialing` / `active` / `past_due` /
    `cancelled`) — base-plan billing state. An org that's `past_due` or
    `cancelled` loses access to *everything*, same as a banned org.
  - Per-add-on entitlement (`org_has_addon()`) — gates individual paid
    features independently of the above two.
- Role-based membership per org (`owner` / `admin` / `member`).

### Business types & onboarding
- A seeded catalog of business types (Retail, Pharmacy, Restaurant,
  Distributor/Wholesaler, Services) an org selects at onboarding.
- Advisory add-on recommendations per business type, for the onboarding
  screen — never used for enforcement.

### Add-on marketplace
- A priced catalog of add-ons, each with its own minimum commitment period.
- Per-org entitlement tracking with full subscribe/cancel history (not
  just a boolean — cancelled subscriptions are kept, not deleted).
- Controlled entirely through two guarded functions
  (`subscribe_org_to_addon` / `cancel_org_addon`) — an org can never grant
  itself a paid feature.
- Add-ons renew on the org's base-plan cycle, not independently.
- Ready for future features to gate themselves behind a paid add-on with
  one line, the same way tables already gate themselves behind org
  membership.

### Parties
- Customers and vendors, each with structured billing address, tax ID
  (GSTIN), notes, and audit fields (`created_by`/`created_at`).

### Catalog & inventory
- Items with SKU, HSN/SAC code, unit, default sell/cost price, tax rate,
  reorder level, and an inventory-tracking toggle (a service/non-stock
  item just skips the stock ledger entirely).
- Multi-warehouse stock, always derived — never hand-edited.
- An **append-only stock ledger**: every stock change (purchase, sale,
  return, adjustment, and their void reversals) is a permanent row;
  corrections are offsetting entries, never edits. Enforced by trigger,
  even against the service role.
- Direct client writes to the ledger are restricted to manual adjustments
  only — real sale/purchase/return movements can only be written by the
  system as a consequence of a document's status actually changing.

### Sales
- Invoices with auto-generated sequential numbering (per-org, per prefix),
  auto-computed subtotal/tax/discount/total, and a status machine
  (`draft → sent → partially_paid/paid`, or `void`) that can't be
  hand-typed — `paid` states are only ever earned by recorded payments.
- Line items locked once a document leaves draft — void and reissue
  instead of silently editing a confirmed invoice.
- Payments recorded against invoices (manual, bank transfer, cash, UPI,
  Razorpay-ready with a gateway reference field).
- Named, dated discount schemes (percentage or flat), optionally scoped to
  specific items, with date-window and active-flag enforcement actually
  checked at calculation time.

### Sales returns
- Credit notes referencing the original invoice, with their own numbering
  and status flow, restocking on issue and reversing on void.
- Return quantity validated against what's actually left unreturned on the
  original line.

### Purchases
- Purchase bills (vendor, warehouse, our internal number + the vendor's
  own reference number), same auto-computed totals and earned-status
  pattern as invoices.
- Purchase payments tracked the same way as sales payments.

### Purchase returns
- Debit notes referencing the original bill, destocking on issue,
  reversing on void, with the same over-return protection as credit notes.

### Data integrity, throughout
- Confirmed documents can't be pushed back to draft and re-confirmed
  (no double-firing stock effects).
- Financial documents are never hard-deleted — only voided, so history is
  never silently lost.
- Concurrent writes to the same document (two payments landing at once)
  serialize via row locking instead of racing and silently overwriting
  each other's totals.
- Every function pins its own `search_path` — closes a real Postgres
  privilege-escalation vector, not just a linter nitpick.

### Explicitly not in this version
- Real payment gateway integration — subscriptions and add-ons are
  superadmin-driven for now, but shaped so a webhook can take over later
  without a redesign.
- E-way bill / PO number / vehicle number fields — deferred until it's
  decided whether that means free data-entry or a real paid GSP
  integration.
- GST return-ready reporting (GSTR-1/3B exports, CGST/SGST/IGST split).
- A grace period on `past_due` (locks out immediately, no dunning flow —
  nothing to reconcile against without real billing yet).
- Multi-vertical schema (real estate, etc.) — not built, but the add-on
  framework is generic enough that a future vertical can reuse it instead
  of needing its own mechanism.

Full field-by-field reference: `schema_structure.csv`. Full design
reasoning: `SYSTEM_DESIGN.md`. Install/upgrade steps and the tested
scenario list: `APPLY.md`.
