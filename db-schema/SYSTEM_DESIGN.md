# Nucleus Billing — System Design (v2)
### Base subscription + add-on marketplace architecture

Status: **design review — not yet implemented in SQL**
Scope: billing CRM only (see §7 for future multi-vertical extensibility notes)

---

## 1. Overview

The core transactional schema (organizations, invoices, items, stock, payments, etc.) is proven and carries forward unchanged from the current schema. What's new in this revision is the **access-control layer** sitting above it: a way to gate the entire product on whether an org has paid for the base plan, and gate individual features on whether an org has separately paid for a specific add-on.

Because the current live schema has no data worth preserving, this is written as a **fresh set of schema files**, not an incremental patch on top of the old ones.

---

## 2. Access Control Model — three independent gates

Every table in the schema is reachable only through two helper functions, `billing.is_org_member()` and `billing.is_org_admin()`. Today those functions check one thing (`organizations.is_active`). This design adds a second check to the *same* two functions, plus a separate, narrower helper for add-on-gated features. Because everything already routes through these functions, adding a check here covers all ~55 existing RLS policies with no per-table changes required.

| Gate | Question it answers | Column(s) | Who can change it | Superadmin bypass? |
|---|---|---|---|---|
| **`is_active`** | Has a superadmin suspended this org? (fraud, abuse, manual ban) | `organizations.is_active` | superadmin only (existing trigger) | Yes |
| **`subscription_status`** | Has this org paid for the base plan? | `organizations.subscription_status`, `subscription_current_period_end` | superadmin only (new trigger, same pattern) | Yes |
| **Add-on entitlement** | Does this org additionally have *this specific* feature? | `organization_addon_subscriptions.status` | superadmin/service_role only, via functions | **Open decision — see §6** |

These compose. An org that's behind on the base plan loses access to *everything*, regardless of which add-ons it separately holds — the base-plan check happens inside `is_org_member()`, which every other check depends on.

```
is_org_member(org)
  = is_superadmin()
    OR ( membership exists
         AND org.is_active
         AND org.subscription_status IN ('trialing', 'active') )
```

`is_org_admin()` gets the identical additional clause, on top of its existing role check.

---

## 3. Core schema (carried forward, unchanged)

No redesign — the gap analysis against mybillbook didn't flag structural problems with these, just missing feature *breadth* (batch/expiry, multi-shipping-address, etc.), which is out of scope for this pass.

`organizations` · `memberships` · `superadmins` · `customers` · `vendors` · `tax_rates` · `warehouses` · `items` · `item_stock` · `stock_movements` · `offers` / `offer_items` · `org_document_counters` · `invoices` / `invoice_items` · `payments` · `credit_notes` / `credit_note_items` · `purchase_bills` / `purchase_bill_items` · `purchase_payments` · `debit_notes` / `debit_note_items`

---

## 4. New: base subscription gating

**`billing.organizations`** gets two new columns:

| column | type | notes |
|---|---|---|
| `subscription_status` | `text not null default 'trialing'`, check in `('trialing','active','past_due','cancelled')` | |
| `subscription_current_period_end` | `timestamptz` | when the current paid (or trial) period ends |

A new trigger, `check_organization_subscription_change()`, mirrors the existing `check_organization_active_change()` — `before update of subscription_status`, raises unless the caller is a superadmin. No org can pay itself into `'active'` by writing the column directly; today a superadmin sets it manually, and later a payment webhook (running as `service_role`) would call the same guarded path.

`'trialing'` and `'active'` pass the `is_org_member()` gate; `'past_due'` and `'cancelled'` do not (see §8, open decision on `past_due`).

---

## 5. New: business types & onboarding

**`billing.business_types`** — catalog table.

| column | type |
|---|---|
| `id` | uuid PK |
| `name` | text not null |
| `slug` | text not null unique |
| `description` | text |
| `is_active` | boolean not null default true |
| `created_at` | timestamptz |

Starter seed (proposed, see §8): Retail/General Store, Pharmacy, Restaurant/Food Service, Distributor/Wholesaler, Services.

**`billing.organizations.business_type_id`** — new nullable FK, set at onboarding.

**`billing.business_type_addon_recommendations`** — purely advisory, never used for enforcement, only for the onboarding UI ("as a pharmacy, you'll probably want batch/expiry tracking").

| column | type |
|---|---|
| `business_type_id` | uuid references business_types(id) |
| `addon_id` | uuid references addons(id) |
| `note` | text — short reason shown to the user |
| | unique(business_type_id, addon_id) |

---

## 6. New: add-on marketplace

**`billing.addons`** — catalog table.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text not null | e.g. "E-Way Bill" |
| `slug` | text not null unique | stable key app code checks against |
| `description` | text | |
| `price` | numeric(10,2) not null | monthly |
| `min_commitment_days` | integer not null default 30 | |
| `is_active` | boolean not null default true | superadmin retires an addon from new purchases without touching existing subscribers |
| `created_at` | timestamptz | |

**`billing.organization_addon_subscriptions`** — the actual entitlement table.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `org_id` | uuid not null references organizations(id) | |
| `addon_id` | uuid not null references addons(id) | |
| `status` | text not null, check in `('active','cancelled')` | |
| `started_at` | timestamptz not null default now() | |
| `min_commitment_until` | timestamptz not null | `started_at + addon.min_commitment_days` |
| `cancelled_at` | timestamptz | null unless cancelled |
| `renews_at` | timestamptz | synced to the org's base-plan renewal date (shared cycle, not independent) |

Partial unique index: `(org_id, addon_id) WHERE status = 'active'` — one active subscription per org+addon at a time, but cancelled rows stay for history.

Writes go through two `SECURITY DEFINER` functions, not direct table access:
- `billing.subscribe_org_to_addon(org_id, addon_slug)`
- `billing.cancel_org_addon(org_id, addon_slug)`

Both superadmin/service_role-only for now — an org can never grant itself a paid entitlement.

**Enforcement choke point:** `billing.org_has_addon(p_org_id uuid, p_addon_slug text)` — `security definer`, `stable`. Checks for an active, non-expired subscription joined to `addons.slug`. Every future gated feature (a future `eway_bills` table, for example) uses this the same way existing tables use `is_org_member()`:

```sql
using (billing.is_org_member(org_id) and billing.org_has_addon(org_id, 'eway-bill'))
```

---

## 7. RLS strategy summary

| Table | Read | Write |
|---|---|---|
| `business_types` | all authenticated | superadmin only |
| `addons` | all authenticated | superadmin only |
| `business_type_addon_recommendations` | all authenticated | superadmin only |
| `organization_addon_subscriptions` | `is_org_member(org_id)` | superadmin/service_role only, via the two functions above — no direct insert/update policy, no delete policy at all (append + status flag, same shape as `stock_movements`) |

---

## 8. Open decisions — need your call before SQL gets written

These are either genuinely unanswered, or defaults I picked that you haven't explicitly confirmed. Flagged here rather than silently baked in.

- [ ] **`subscription_status` default for a brand-new org** — `'trialing'` (grace period before anyone has to touch billing) vs. `'active'` (superadmin flips it only when someone actually lapses)? *(asked last turn, still open)*
- [ ] **Does `'past_due'` lock the org out immediately**, same as `'cancelled'`? Current design says yes (only `'trialing'`/`'active'` pass). No grace period/dunning logic exists yet since there's no payment gateway wired up — flagging in case you want `past_due` to still pass for some window.
- [ ] **Should superadmin bypass `org_has_addon()` too**, the way it bypasses `is_active` and `subscription_status`? Not yet decided — my default would be yes, for support/ops access, but it's a new gap not previously discussed.
- [ ] **Starter business type list** — Retail/General Store, Pharmacy, Restaurant/Food Service, Distributor/Wholesaler, Services — confirm or edit.
- [ ] **Add-on renewal tied to base-plan cycle** (shared `renews_at`) rather than each add-on having its own independent billing date — confirm.
- [ ] **`organizations.business_type_id` settable by org admin** (like other org settings) rather than superadmin-gated (like `is_active`) — confirm.
- [ ] **`min_commitment_until` is informational only for v1** — shown in the UI, not enforced by a state machine, since there's no real payment collection yet — confirm.

---

## 9. Explicitly out of scope / deferred

- **Invoice compliance columns** (`po_number`, `eway_bill_number`, `vehicle_number`) — deferred until it's decided whether "e-way bill add-on" means manual data-entry fields or real GSP/NIC API generation. Not part of this pass.
- **Real payment gateway integration** — all subscription/addon status changes are manual (superadmin) for now; the schema is shaped so a webhook can call the same guarded functions later without redesign.
- **Multi-vertical schema** (real estate, etc.) — not built now. The add-on framework here is deliberately generic (catalog table + org entitlement table + slug-based checks) so a future vertical module can reuse the same mechanism instead of needing its own.

---

## 10. Why this is low-risk to build now

Every new enforcement mechanism here — trigger-guarded status column, superadmin-only writes, a boolean folded into the existing membership-check functions — is a direct reuse of the pattern already proven by `is_active` in the current schema. Nothing here introduces a new *kind* of mechanism, just more columns and one more helper function riding the same rails.
