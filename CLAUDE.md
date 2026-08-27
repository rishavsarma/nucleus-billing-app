# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev         # Start dev server (Next.js App Router, Turbopack)
bun run build        # Production build
bun run lint          # ESLint (eslint-config-next core-web-vitals + typescript)
bun run format        # Prettier, writes in place (includes prettier-plugin-tailwindcss for class sorting)
bun run typecheck     # tsc --noEmit
```

There is no test framework configured in this repo (no Jest/Vitest/Playwright). Don't assume one exists or invent test commands.

To add a shadcn/ui component: `npx shadcn@latest add <component>` (lands in `components/ui/`).

## Architecture

### Locale routing and auth gating

Routes live under `app/[locale]/` and are split into two route groups:
- `(app)` — the authenticated product (dashboard, sales, purchases, catalog, parties, inventory, settings, admin)
- `(auth)` — `/login`

`app/api/**` (route handlers) and `app/auth/**` (Supabase's OAuth/magic-link callback) are *not* locale-prefixed.

The middleware entry point is `proxy.ts` at the repo root (Next.js 16 renamed `middleware.ts` → `proxy.ts`). It composes next-intl's locale middleware with `lib/supabase/proxy.ts`'s `updateSession` (refreshes the Supabase session cookie), then redirects based on two prefix lists defined at the top of `proxy.ts`:
- `PROTECTED_PREFIXES` — bounces signed-out users to `/login`
- `AUTH_ONLY_PREFIXES` — bounces signed-in users away (currently just `/login`)

Any new top-level section under `(app)` must be added to `PROTECTED_PREFIXES` or it won't be gated — `/dashboard` was missing until it was added alongside this note; when adding a new `(app)` section, grep `PROTECTED_PREFIXES` in `proxy.ts` before assuming middleware already covers it.

### Multi-tenant data access

The `billing` schema lives in `db-schema/` at the repo root: `001_billing_schema.sql`–`004_grants.sql` (base, apply in order, not idempotent) plus standalone numbered patches on top (`005_delivery_and_public_pricing.sql` is the first — additive-only, safe to run against a live database, never a rewrite of `001`–`004`). `db-schema/schema_structure.csv` is the field-by-field reference; `db-schema/CLAUDE.md` has the DB-side rules (RLS shapes, trigger guards) this file's app-side rules are derived from — read it before touching anything under `lib/database/`. There is no single `schema.sql` dump at the repo root; don't create one or reference one that doesn't exist. Every table has an `org_id` FK except a few globally-scoped ones (`superadmins`, and the three catalog tables covered below).

`lib/database/require-org.ts` is the auth/authorization layer every `app/api/database/*` route handler goes through:
- `requireOrgId()` — resolves the caller's org via `billing.memberships`; superadmins get `orgId: null, isSuperadmin: true` meaning "don't filter by org." Callers must branch on `isSuperadmin` and skip `.eq("org_id", ...)` when true.
- `requireUserId()` — weaker check for routes that don't need org membership yet (e.g. creating the first org).
- `requireMemberOf(orgId)` — verifies membership in a *specific* org.
- `requireSuperadmin()` — global, non-org-scoped role check.
- `verifyBelongsToOrg(...)` — validates a foreign-key reference in a request body belongs to the caller's org before writing it, since RLS insert/update policies only check the row's own `org_id`, not sibling FK columns referencing other tables.

**Check every FK in the body, not just the parent.** A `*_items` route (`invoice_items`, `credit_note_items`, `debit_note_items`, `purchase_bill_items`) needs two `verifyBelongsToOrg` calls, not one: the parent document (`invoice_id`/etc.) *and* `body.item_id` when present. `offer_items/route.ts` had this right from the start; the other four were missing the `item_id` check until an audit caught it (fixed — grep `verifyBelongsToOrg` in each file to confirm before assuming it's covered). The general rule: every foreign key accepted from the request body — not just the one used to resolve the org — needs its own `verifyBelongsToOrg` call, because RLS only validates the row's own `org_id`/immediate parent, never a sibling FK pointing at a third table.

### Staff vs. memberships — two different kinds of "person"

`billing.memberships` (real, Supabase-authenticated users who can log in — `owner`/`admin`/`member`) and `billing.staff` (record-only people with no login at all — delivery persons, movers, `role = 'other'` for anything else, added in `011_staff_and_membership_limit.sql`) are deliberately separate tables, not a shared "people" table with a login flag. Don't merge them or add auth to `staff` rows — the whole point is that most of an org's workforce (delivery drivers, movers) never needs a Supabase account, a seat, or RLS-gated access to anything; they're just a name+role the app can assign things to (currently: `deliveries.delivery_person_id`).

- `billing.staff.role` is `'delivery_person' | 'mover' | 'other'`, with `role_label` as a free-text field only meaningful when `role = 'other'` (e.g. "Warehouse helper") — don't add new fixed role values casually; `role = 'other'` plus `role_label` is the intended escape hatch for anything that isn't delivery/moving.
- **`billing.memberships` is capped at 3 rows per `org_id`**, enforced by the `memberships_limit_guard` trigger (`before insert`, raises `membership_limit_reached` via `P0001`) — a flat, hardcoded limit for now, not a per-subscription-tier value. `app/api/database/memberships/route.ts`'s `POST` maps that trigger's error message to a stable `code: "membership_limit_reached"` in its JSON response (same "stable code, not raw message" pattern as the i18n section below) so the client can show a translated message instead of raw Postgres text. `staff` rows don't count toward this limit — it's specifically about login-capable seats.
- The "Invite Member" flow in `settings/members` is still a self-documented stub (confirmed deliberately manual per an explicit product decision — not a gap to fill without asking first); the seat counter next to the page title and the disabled Invite button at the cap are real, though.

### Access control — three independent gates (DB-enforced, not just `require-org.ts`)

`billing.is_org_member(org_id)` / `billing.is_org_admin(org_id)` — the functions essentially every RLS policy in the schema routes through — compose three checks, not one:

1. **`organizations.is_active`** — superadmin ban switch. **Live in this app** — `Organization.is_active` is in `lib/database/types.ts`, set via `organizations_active_change_guard` at the DB level, surfaced through the existing `organizations` route/service/hooks.
2. **`organizations.subscription_status`** — `'trialing'`/`'active'` pass; `'past_due'`/`'cancelled'` do not. Independent of `is_active`; either one failing locks the org out of *everything*. **Not yet in this app** — `subscription_status` / `subscription_current_period_end` aren't on `Organization` in `lib/database/types.ts` yet, and nothing in `app/`, `hooks/`, or `lib/database/services/` reads or writes them (confirmed by grep — zero hits). The DB-side gate exists in `db-schema/` regardless of whether the app knows about it yet.
3. **Add-on entitlement** (`billing.org_has_addon(org_id, slug)`) — narrower, only gates specific add-on-locked features, not membership itself. **Not yet in this app** — no `addons`/`organization_addon_subscriptions` entity anywhere in `lib/database/`, `hooks/`, or `app/api/database/`.

Superadmins bypass 1 and 2 entirely (not 3, by default — `org_has_addon` doesn't special-case superadmin).

**The gotcha, once gate 2 is wired up:** when gate 1 or 2 fails, `is_org_member()` returns `false` and every org-scoped `select` policy just filters the org's rows out — there's no distinct error, the query succeeds and returns an empty array. A route handler or page that only checks "did the query error" will render a plausible-looking empty dashboard for a suspended or lapsed org instead of an actionable "your subscription is past due" message. Any screen reachable by a member of a possibly-non-active org (i.e. anything past login) should separately check `organizations.is_active` / `subscription_status` — via a superadmin-scoped read or a small `security definer` status-check RPC — rather than inferring org health from whether the data queries came back empty. This already applies to `is_active` today, not just the future `subscription_status` addition — worth checking whether any current screen has this gap.

Neither `organizations.is_active` nor `subscription_status` can be written by app code, even through the service-role client (`lib/supabase/admin.ts`) — both are trigger-guarded to superadmin-only writes. Don't build a settings toggle for either; subscription lifecycle changes are a superadmin/payment-webhook concern, not something `requireOrgId()`-gated routes should expose.

### Financial documents — void, not delete

`invoices`, `purchase_bills`, `credit_notes`, `debit_notes`, `payments`, `purchase_payments` have **no delete RLS policy at all** — this is deliberate (financial history is never hard-deleted). This matters for the four-layer CRUD pattern below:

- **Don't generate a `DELETE` handler for these six entities.** A `DELETE` request against a table with no delete policy doesn't error — it just matches and deletes zero rows, which reads as success to a naive route handler (`204` with nothing actually removed, or worse, a misleading "not found"). Implement cancellation as a `PUT` that sets `status = 'void'` instead, and don't wire a delete button/mutation to these entities in the UI.
- **Status only moves forward** — a trigger rejects any transition back to `draft`, and rejects any change at all once a document is `void`. Build the status control as a linear flow (draft → confirm → [record payment] → paid, or → void), not a free dropdown.
- **`paid`/`partially_paid` aren't settable directly** — they're derived from actual rows in `payments`/`purchase_payments`. Don't offer them as status options; they only change as a side effect of the payment-recording mutation.
- **Line items lock once the parent leaves `draft`.** The edit form for a confirmed invoice/bill/note should be read-only on line items — offer "void and create new" instead of an edit path that will fail server-side.
- **Totals (`subtotal`, `tax_total`, `discount_total`, `total`, `amount_paid`) are auto-maintained by trigger.** Never include these in a client-constructed insert/update payload for these tables — pass line items and payments, let the DB compute totals, and refetch.

`deliveries` and `billing.staff` (the local-delivery feature) are the one deliberate exception to this financial-document treatment — they're operational tracking, not money, so both normal delete and free status transitions (including back to `pending`) are allowed there. **Built** — full four-layer CRUD for both, a `catalog/staff` management page, a "Delivery" toggle in the POS cart (address, delivery-person `Select`, COD/Prepaid `Select`, upserted on Save as Draft/Complete Sale), and a Delivery card with a live status `Select` on the invoice detail page. `billing.delivery_persons` was renamed to `billing.staff` in `011_staff_and_membership_limit.sql` — see "Staff vs. memberships" below.

The current six financial-document route handlers already follow the no-delete rule correctly (verified: `GET`/`POST`/`PUT` only, no `DELETE`, on all six) — the source comments in `app/api/database/organizations/route.ts` and similar even cite the same "no delete policy" rationale. Keep new financial-document-like entities consistent with this rather than copying the generic delete-enabled shape other entities use.

### Stock — append-only ledger, never hand-edited

`billing.item_stock.quantity_on_hand` is derived, not writable — don't build a "correct stock count" feature that updates it directly. `billing.stock_movements` is append-only (update/delete always fail, even for the service-role client); ordinary org members can only insert `movement_type = 'adjustment'` rows directly — the real movement types (`purchase`, `sale`, `sales_return`, `purchase_return`, and their `_void` counterparts) are written only by the DB itself when a document's status actually changes. A "stock adjustment" feature is the one place `app/api/database/stock-movements` (or similar) should allow a direct insert; everything else should go through confirming/voiding the relevant document.

`quantity_on_hand` is allowed to go negative in the current schema (overselling isn't blocked) — that's a deliberate open policy choice, not a bug to silently fix with a client-side guard that blocks the sale.

### v3 schema features — what's actually built vs. still unwired

The `db-schema/` files (`001`–`005`) define all of the below at the database level, but the app-layer status differs per feature — checked against the code directly (an internal audit on 2026-08-27 found this section stale; this replaces it):

**Built, end to end** — don't treat these as gaps:
- **Subscription gating.** `Organization.subscription_status` / `subscription_current_period_end` are real fields in `lib/database/types.ts`, surfaced through `settings/subscription` (reads the live status/renewal date) and `app/api/me/route.ts` (which deliberately bypasses `requireOrgId()` via the service-role client — see the comment at the top of that file — so a suspended/lapsed member can still learn *why* they're locked out instead of just getting a silent 403). Still superadmin/trigger-only to write, per the access-control section above.
- **Add-on marketplace.** `billing.addons` + `billing.organization_addon_subscriptions` are live: `hooks/use-addons.ts`, `hooks/use-organization-addon-subscriptions.ts`, and a `settings/addons` page with real subscribe/cancel calling `billing.subscribe_org_to_addon()`/`cancel_org_addon()` via `.rpc()`, superadmin-gated as the schema requires.
- **Local delivery.** `billing.staff` (filtered to `role = 'delivery_person'`) / `billing.deliveries` — see the financial-documents section above for the full built feature list (POS toggle, staff catalog page, invoice detail Delivery card).

**Still genuinely unwired** — these remain what to build, not what exists:
- **Business types.** `organizations.business_type_id` exists as a bare field on `Organization` (`lib/database/types.ts:10`) but there is no `business_types` CRUD anywhere — no route, service, hook, or UI. Purely advisory/UX, never used for access control. Building it means a new `business_types` slice through all four CRUD layers, plus wiring `business_type_id` into the org settings/onboarding UI.
- **Add-on-gated features.** `billing.org_has_addon(org_id, slug)` has zero usages in `app/`, `hooks/`, or `lib/` — no feature actually checks add-on entitlement yet, even though the marketplace above lets an org subscribe to one. Once a feature needs gating, combine `requireOrgId()`'s org resolution with a check against `org_has_addon(org_id, 'slug')` via `.rpc()` — same shape the DB-side RLS policies use, don't reimplement the entitlement check as a plain table read.
- **Public pricing calculator.** `business_types`, `addons`, and `business_type_addon_recommendations` are readable by **anonymous** requests as of the `005` patch (`for select using (true)`) — this is what would power a logged-out pricing calculator on a marketing site, once one exists (none does yet). Write access to all three stays superadmin-only. Don't extend this "public read" treatment to any other table without an explicit ask.

### The four-layer CRUD pattern

Every billing entity (customers, invoices, items, etc.) follows the same four layers — copy this shape for new entities rather than improvising:

1. **`app/api/database/<entity>/route.ts`** — GET/POST/PUT/DELETE route handlers. Call `requireOrgId()` first, use `lib/supabase/server.ts`'s `createClient()`, query via `.schema("billing").from("<entity>")`, filter by `org_id` unless `isSuperadmin`. PUT/DELETE take `id` as a query param, not in the path. **Skip the `DELETE` handler for the six financial-document entities** — see above.
2. **`lib/database/services/<entity>.ts`** — thin async functions wrapping `lib/axios.ts`'s `api` instance (`baseURL: "/api"`, `withCredentials: true`, Sentry-reporting interceptor).
3. **`hooks/use-<entity>.ts`** — TanStack Query hooks (`useQuery` for reads, `useMutation` + `queryClient.invalidateQueries` on writes). `QueryProvider` (in `app/layout.tsx`) wraps the whole app, so any client component can use these directly.
4. **`lib/database/types.ts`** — plain hand-written TS interfaces mirroring `db-schema/*.sql` (no generated Supabase types in this project).

Non-CRUD services that don't belong under `lib/database/` (e.g. auth) go in `lib/services/` instead, with a matching `hooks/use-<name>.ts`.

### Supabase clients — which one to use where

- `lib/supabase/client.ts` — browser client (Client Components).
- `lib/supabase/server.ts` — server client via `next/headers` cookies (Server Components, route handlers).
- `lib/supabase/admin.ts` — service-role client, bypasses RLS entirely. `server-only`; only for trusted server contexts, never anything reachable from the browser. Note: bypassing RLS does **not** bypass the `is_active`/`subscription_status` write guard triggers on `organizations`, or the append-only guard on `stock_movements` — those reject the service role too, on purpose.
- `lib/supabase/proxy.ts` — session-refresh used exclusively from `proxy.ts` middleware.

### i18n — no hardcoded user-facing strings

This app uses `next-intl`. Locales are defined in `i18n/routing.ts` (currently `en`, `hi`, `as`; `en` is default), with per-locale message files in `messages/*.json`. `i18n/navigation.ts` exports locale-aware `Link`, `redirect`, `useRouter`, `usePathname` — use these instead of `next/link` / `next/navigation` inside `(app)`/`(auth)` routes so locale prefixes are preserved.

**Every user-facing string must come from a message file, not be hardcoded in a component.** Add the key to `messages/en.json` and mirror it in `hi.json` and `as.json` (a real translation, not the English string as a placeholder), then read it with `useTranslations("Namespace")`. This works in both Client and Server Components without `await` — including ones outside `app/[locale]/` (e.g. `app/auth/auth-code-error/page.tsx`), since the next-intl plugin patches every RSC render, not just locale-prefixed routes. The one place `useTranslations` doesn't work is an **async** Server Component (e.g. a `[id]/page.tsx` that awaits `params`) — hooks can't be called after an `await`, so use `getTranslations` from `next-intl/server` there instead (`const t = await getTranslations("Namespace")`). See `hooks/use-login.ts` + `components/login-form.tsx` for a client mutation example, and any `[id]/page.tsx` under `(app)/` for the async-server example.

This applies to visible text, `aria-label`s, and placeholder text. It does not apply to: internal error messages, log strings, or code comments; **data values** (e.g. row content in `lib/database/types.ts`-shaped objects — a customer's actual name isn't UI copy); or **proper-noun brand/preset names** — the theme preset labels in `lib/theme-preset-data.ts` (e.g. "Violet Bloom") and the app's own brand name are names, not sentences, and aren't translated (same reasoning as not translating `LanguageSwitcher`'s own `en`/`hi`/`as` labels — those are the language names in their own language, not English descriptions of them). `app/global-error.tsx` is also exempt by design: it's the Next.js root error boundary that renders when even the root layout has crashed, so it must not depend on any app provider (next-intl included) to stay functional as a fallback. More generally: **any client component rendered directly in `app/layout.tsx`** (not inside `{children}`) is exempt too, for a more mundane reason — `NextIntlClientProvider` is set up in `app/[locale]/layout.tsx`, one level *inside* `{children}`, so a client component siblings-of-`{children}` in the true root has no provider to call `useTranslations` against and will throw `Failed to call useTranslations because the context from NextIntlClientProvider was not found`. `components/theme-loader-overlay.tsx` is the current example.

**Server errors surfaced to the client should use a stable `code`, not the raw message, when you want it translatable.** `app/api/auth/login/route.ts` returns both `error` (raw English, e.g. Supabase's `error.message`) and `code` (e.g. `"invalid_credentials"`, from Supabase's stable `error.code` / a hand-assigned code for validation failures). The client (`components/login-form.tsx`) maps known codes to translated strings via `useTranslations`, and only falls back to the untranslated raw message for codes it doesn't recognize. Follow this pattern for any other endpoint whose errors reach the UI — don't render `response.data.error` directly if it's meant to be seen by non-English users. Apply the same pattern to the access-control gotcha above: a route that detects an inactive/past-due org itself (rather than letting RLS silently empty the result) should return a stable `code` like `"org_suspended"` / `"subscription_past_due"`, not a raw message.

### State outside TanStack Query

`store/theme-preset-store.ts` is a `zustand` store (with `persist` to localStorage) for the color theme preset — used for UI state that needs to survive outside the React tree, e.g. read by `components/theme-preset-script.tsx`, an inline `beforeInteractive` script that paints the saved preset before hydration to avoid a flash of the default theme. Follow this pattern (zustand + persist) for similar client-only, non-server-backed UI state; use TanStack Query for anything that's actually server data.

### Misc

- Sentry wraps `next.config.ts` (`withSentryConfig`), tunneled through `/monitoring` to dodge ad-blockers — `proxy.ts`'s matcher excludes `monitoring`, `api`, and `auth` paths.
- `lib/redis.ts` (ioredis) and `lib/resend.ts` (Resend email) are thin client exports; `app/api/redis/route.ts` is a leftover connectivity smoke test, not a real endpoint.
- **The dashboard has been split into three real, linked pages** — `dashboard/{overview,reports,analysis}/page.tsx`, each with its own `data.json` fixture, replacing the single unmodified `dashboard/page.tsx` demo this note used to describe. `AppSidebar` now links to all three (`/dashboard/overview`, `/dashboard/reports`, `/dashboard/analysis`), and `overview`/`analysis` genuinely import `components/{chart-area-interactive,data-table,section-cards}.tsx` — those three are real product surface now, not dead demo code; don't delete them. `dashboard/reports/page.tsx` is currently just `<ThemeShowcase />` — a placeholder, not real reporting. None of the three pages go through the four-layer CRUD pattern yet — they render from local `data.json`, not `hooks/use-*`/live queries; wire them to real data through that pattern when building actual dashboard content instead of extending the fixtures.
- **`components/{nav-main,nav-secondary,nav-documents,site-header}.tsx` are still genuinely dead** — confirmed unimported anywhere outside their own files (`(app)/layout.tsx` builds its header inline instead of using `SiteHeader`, and `AppSidebar` builds its own nav groups instead of using `NavMain`/`NavSecondary`/etc.). Delete them or wire them up; don't extend them as if something depends on them. `components/nav-user.tsx` is the one exception — it's now wired into `AppSidebar`'s `SidebarFooter` as the real profile card (avatar initials from email, role badge via the `Roles` i18n namespace, real log-out), replacing the shadcn demo scaffolding (hardcoded "CN" initials, fake Account/Billing/Notifications menu items) it shipped with. `/api/me` now returns `email`/`role` alongside the existing fields to back it.
- **Fixed:** `/dashboard` was missing from `proxy.ts`'s `PROTECTED_PREFIXES` even though it's now real, sidebar-linked product surface (not the harmless dead demo this note previously described it as) — a signed-out user could reach `/[locale]/dashboard/overview` etc. without being redirected to `/login`. Added to `PROTECTED_PREFIXES` alongside this doc update. If another `(app)` section is ever added without a matching `PROTECTED_PREFIXES` entry, it'll have the same gap.
- `(app)/layout.tsx`'s comment previously said "Auth is enforced in middleware.ts" — stale after the Next.js 16 `middleware.ts` → `proxy.ts` rename (see "Locale routing and auth gating" above); fixed to say `proxy.ts`.
