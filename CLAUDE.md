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

Any new top-level section under `(app)` must be added to `PROTECTED_PREFIXES` or it won't be gated.

### Multi-tenant data access

`schema.sql` at the repo root is a reference-only dump of the Supabase `billing` schema (not meant to be executed — see its header comment). Every table has an `org_id` FK except a few globally-scoped ones (`superadmins`).

`lib/database/require-org.ts` is the auth/authorization layer every `app/api/database/*` route handler goes through:
- `requireOrgId()` — resolves the caller's org via `billing.memberships`; superadmins get `orgId: null, isSuperadmin: true` meaning "don't filter by org." Callers must branch on `isSuperadmin` and skip `.eq("org_id", ...)` when true.
- `requireUserId()` — weaker check for routes that don't need org membership yet (e.g. creating the first org).
- `requireMemberOf(orgId)` — verifies membership in a *specific* org.
- `requireSuperadmin()` — global, non-org-scoped role check.
- `verifyBelongsToOrg(...)` — validates a foreign-key reference in a request body belongs to the caller's org before writing it, since RLS insert/update policies only check the row's own `org_id`, not sibling FK columns referencing other tables.

### The four-layer CRUD pattern

Every billing entity (customers, invoices, items, etc.) follows the same four layers — copy this shape for new entities rather than improvising:

1. **`app/api/database/<entity>/route.ts`** — GET/POST/PUT/DELETE route handlers. Call `requireOrgId()` first, use `lib/supabase/server.ts`'s `createClient()`, query via `.schema("billing").from("<entity>")`, filter by `org_id` unless `isSuperadmin`. PUT/DELETE take `id` as a query param, not in the path.
2. **`lib/database/services/<entity>.ts`** — thin async functions wrapping `lib/axios.ts`'s `api` instance (`baseURL: "/api"`, `withCredentials: true`, Sentry-reporting interceptor).
3. **`hooks/use-<entity>.ts`** — TanStack Query hooks (`useQuery` for reads, `useMutation` + `queryClient.invalidateQueries` on writes). `QueryProvider` (in `app/layout.tsx`) wraps the whole app, so any client component can use these directly.
4. **`lib/database/types.ts`** — plain hand-written TS interfaces mirroring `schema.sql` (no generated Supabase types in this project).

Non-CRUD services that don't belong under `lib/database/` (e.g. auth) go in `lib/services/` instead, with a matching `hooks/use-<name>.ts`.

### Supabase clients — which one to use where

- `lib/supabase/client.ts` — browser client (Client Components).
- `lib/supabase/server.ts` — server client via `next/headers` cookies (Server Components, route handlers).
- `lib/supabase/admin.ts` — service-role client, bypasses RLS entirely. `server-only`; only for trusted server contexts, never anything reachable from the browser.
- `lib/supabase/proxy.ts` — session-refresh used exclusively from `proxy.ts` middleware.

### i18n — no hardcoded user-facing strings

This app uses `next-intl`. Locales are defined in `i18n/routing.ts` (currently `en`, `hi`, `as`; `en` is default), with per-locale message files in `messages/*.json`. `i18n/navigation.ts` exports locale-aware `Link`, `redirect`, `useRouter`, `usePathname` — use these instead of `next/link` / `next/navigation` inside `(app)`/`(auth)` routes so locale prefixes are preserved.

**Every user-facing string must come from a message file, not be hardcoded in a component.** Add the key to `messages/en.json` and mirror it in `hi.json` and `as.json` (a real translation, not the English string as a placeholder), then read it with `useTranslations("Namespace")`. This works in both Client and Server Components without `await` — including ones outside `app/[locale]/` (e.g. `app/auth/auth-code-error/page.tsx`), since the next-intl plugin patches every RSC render, not just locale-prefixed routes. The one place `useTranslations` doesn't work is an **async** Server Component (e.g. a `[id]/page.tsx` that awaits `params`) — hooks can't be called after an `await`, so use `getTranslations` from `next-intl/server` there instead (`const t = await getTranslations("Namespace")`). See `hooks/use-login.ts` + `components/login-form.tsx` for a client mutation example, and any `[id]/page.tsx` under `(app)/` for the async-server example.

This applies to visible text, `aria-label`s, and placeholder text. It does not apply to: internal error messages, log strings, or code comments; **data values** (e.g. row content in `lib/database/types.ts`-shaped objects — a customer's actual name isn't UI copy); or **proper-noun brand/preset names** — the theme preset labels in `lib/theme-preset-data.ts` (e.g. "Violet Bloom") and the app's own brand name are names, not sentences, and aren't translated (same reasoning as not translating `LanguageSwitcher`'s own `en`/`hi`/`as` labels — those are the language names in their own language, not English descriptions of them). `app/global-error.tsx` is also exempt by design: it's the Next.js root error boundary that renders when even the root layout has crashed, so it must not depend on any app provider (next-intl included) to stay functional as a fallback. More generally: **any client component rendered directly in `app/layout.tsx`** (not inside `{children}`) is exempt too, for a more mundane reason — `NextIntlClientProvider` is set up in `app/[locale]/layout.tsx`, one level *inside* `{children}`, so a client component siblings-of-`{children}` in the true root has no provider to call `useTranslations` against and will throw `Failed to call useTranslations because the context from NextIntlClientProvider was not found`. `components/theme-loader-overlay.tsx` is the current example.

**Server errors surfaced to the client should use a stable `code`, not the raw message, when you want it translatable.** `app/api/auth/login/route.ts` returns both `error` (raw English, e.g. Supabase's `error.message`) and `code` (e.g. `"invalid_credentials"`, from Supabase's stable `error.code` / a hand-assigned code for validation failures). The client (`components/login-form.tsx`) maps known codes to translated strings via `useTranslations`, and only falls back to the untranslated raw message for codes it doesn't recognize. Follow this pattern for any other endpoint whose errors reach the UI — don't render `response.data.error` directly if it's meant to be seen by non-English users.

### State outside TanStack Query

`store/theme-preset-store.ts` is a `zustand` store (with `persist` to localStorage) for the color theme preset — used for UI state that needs to survive outside the React tree, e.g. read by `components/theme-preset-script.tsx`, an inline `beforeInteractive` script that paints the saved preset before hydration to avoid a flash of the default theme. Follow this pattern (zustand + persist) for similar client-only, non-server-backed UI state; use TanStack Query for anything that's actually server data.

### Misc

- Sentry wraps `next.config.ts` (`withSentryConfig`), tunneled through `/monitoring` to dodge ad-blockers — `proxy.ts`'s matcher excludes `monitoring`, `api`, and `auth` paths.
- `lib/redis.ts` (ioredis) and `lib/resend.ts` (Resend email) are thin client exports; `app/api/redis/route.ts` is a leftover connectivity smoke test, not a real endpoint.
- `app/[locale]/(app)/dashboard/page.tsx` plus `components/{section-cards,chart-area-interactive,data-table}.tsx` and `components/{nav-main,nav-secondary,nav-documents,nav-user,site-header}.tsx` are the original, unmodified shadcn "dashboard-01" demo block — fake data, no sidebar link points at `/dashboard` (the real landing page is `(app)/page.tsx`), and `nav-main`/`nav-secondary`/`nav-documents`/`nav-user` aren't imported anywhere. Also note `/dashboard` isn't in `proxy.ts`'s `PROTECTED_PREFIXES`, so it's reachable while signed out. Don't extend this demo code as if it were real product surface — either wire it up as a real feature or delete it.
