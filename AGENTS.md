# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

openstarter is a production-ready full-stack SaaS starter built with:

- **Monorepo**: Turborepo + pnpm workspaces
- **Framework**: TanStack Start + TanStack Router (web)
- **Backend**: Hono RPC API mounted at `/api/*`
- **Database**: Drizzle ORM (Cloudflare D1; sqlite dialect for D1 and the test harness)
- **Multi-platform**: Web, Desktop (Electron), Mobile (Expo), Browser Extension (WXT), CLI, Mini-App (Taro)
- **Auth**: Better-Auth with OAuth, passkey, 2FA, organizations
- **Billing**: Stripe/PayPal/Alipay/WeChat Pay with credit system
- **i18n**: inlang/Paraglide (web)、@wxt-dev/i18n (extension)、i18next + react-i18next (mobile)
- **Testing**: Vitest
- **Linting**: oxlint + oxfmt (Oxc toolchain)

## Monorepo Structure

```
openstarter/
├── apps/                  # Client applications
│   ├── web/               # TanStack Start (SSR, file-based routing)
│   ├── desktop/           # Electron + React
│   ├── mobile/            # Expo Router (React Native)
│   ├── extension/         # WXT + React
│   ├── cli/               # Command-line interface
│   └── mini-app/          # Taro (WeChat Mini App)
│
├── packages/              # Shared libraries (published as @openstarter/*)
│   ├── api/               # Hono RPC backend — hosts the database layer (src/db: Drizzle
│   │                      # schema, migrations, D1 client) plus better-auth server,
│   │                      # credits, payment, subscriptions, referral
│   ├── auth/              # Better-Auth clients only (client/{web,native,taro}) + rbac/access
│   ├── billing/           # billing/mobile (Expo RevenueCat/Superwall client); server-side
│   │                      # billing lives in packages/api (modules/billing)
│   ├── email/             # React Email templates + providers (Resend, Cloudflare)
│   ├── i18n/              # Per-platform i18n
│   │   ├── web/           # @openstarter/i18n-web (web/auth/email, inlang/Paraglide)
│   │   ├── extension/     # @openstarter/i18n-extension (extension, @wxt-dev/i18n)
│   │   └── mobile/        # @openstarter/i18n-mobile (mobile-specific, i18next)
│   ├── shared/            # Constants, validators, utilities, logger, config
│   ├── analytics/         # Event tracking; one type contract (shared) + per-platform impls analytics/{web,mobile,extension} (mobile: OpenPanel + GA4 Firebase; web: gtag + Plausible; extension: Plausible HTTP)
│   └── ui/                # shadcn components + Tailwind; split by platform into ui/{web,mobile}
│
└── scripts/               # gen-package scaffolder, desktop runner, shared vitest config
```

## API Architecture (`packages/api/`)

The API is organized as modular domains under `src/modules/`, with each domain following a consistent structure:

```
src/
├── index.ts               # Hono app entry, route composition root
├── db/                    # Database layer: Drizzle schema (schema/schema.sqlite.ts),
│                          # D1 migrations (db/migrations/sqlite), runtime client
│                          # (db/server.ts), local D1 bootstrap (db/local.ts),
│                          # test factory (db/testing/)
├── middleware/            # Auth, RBAC, plan gating middleware
├── schema/                # All Zod validation schemas + domain value vocabularies
│                          # (mirrors modules/: schema/user.ts, schema/admin/rbac.ts, schema/mcp.ts, ...)
└── modules/               # Domain modules (routers + services colocated)
    ├── auth/              # Better-Auth engine (server.ts, env, email callbacks, hooks,
    │                      # invite codes, rbac service, types) mounted at /api/auth/*
    ├── billing/           # Checkout + payment providers/webhooks, credits (FIFO),
    │                      # subscriptions, referral commissioning (billing/referral —
    │                      # distinct from user-facing modules/referral)
    ├── config/            # Public config endpoint
    ├── storage/           # Image upload (S3/R2)
    ├── mcp/               # MCP server mounted at /api/mcp (read-only + ticket writes)
    ├── status/            # Health/status endpoint
    ├── user/              # Profile, subscriptions, credits, orders
    ├── admin/             # Admin-only routes
    │   ├── rbac/          # Role/permission management
    │   ├── analytics/     # Admin metrics
    │   ├── overview/      # User/order/subscription/credit lists, invite codes
    │   └── tickets/       # Support ticket management
    ├── support/           # User-facing support
    │   ├── tickets/       # Create/reply to support tickets
    │   └── apikeys/       # API key management
    ├── content/           # Blog, posts, taxonomy, SEO
    │   ├── posts/         # Article CRUD
    │   ├── blog/          # Published articles list
    │   ├── taxonomy/      # Categories/tags
    │   └── seo/           # SEO data (sitemap, llms.txt)
    └── demo/              # Demo endpoints (notes, private-data)
```

### Module Pattern

Each domain module follows this pattern:

```
modules/{domain}/
├── router.ts              # Hono router (route definitions; validation schemas
│                          # imported from src/schema/{domain})
├── service.ts             # Business logic (optional, for complex domains)
└── index.ts               # Barrel export (optional)
```

For larger modules with sub-domains:

```
modules/{domain}/
├── router.ts              # Domain aggregator router
├── {subdomain}/
│   ├── router.ts          # Sub-router
│   └── service.ts         # (optional)
└── ...
```

### Schema Organization

All Zod validation schemas (and the domain value vocabularies they consume)
live in `src/schema/`, mirroring the `modules/` layout. Routers and services
import from there; `schema/` never imports back from `modules/`:

- `schema/shared.ts` — cross-domain schemas exported via the `schema` barrel:
  - `idParam` — standard ID parameter schema
  - `paginationSchema` — default pagination (page + pageSize)
  - `createPaginationSchema(max, default)` — custom pagination
- `schema/{domain}.ts` — domain-specific schemas (`schema/user.ts`,
  `schema/billing.ts`, `schema/referral.ts`, ...), including domain
  vocabularies born for validation (`PostType`/`POST_TYPE_VALUES`,
  `TICKET_STATUS`/`TICKET_STATUS_VALUES`, ...)
- `schema/{domain}/{subdomain}.ts` — mirrors sub-domain routers
  (`schema/content/posts.ts`, `schema/admin/rbac.ts`, `schema/support/tickets.ts`, ...)
- `schema/mcp.ts` — MCP tool input schemas (`mcpPaginationSchema`,
  ticket/order tools; use plain `z.number()` — MCP args are already
  native JSON — and carry `.describe()` strings for the model)

Domain schema files use locally-scoped names (`listQuery`, `createBody`, ...);
they are imported from their specific path (not the barrel) to avoid
cross-domain name collisions:

```ts
// modules/admin/overview/router.ts
import { idParam } from "../../../schema"; // shared barrel
import { inviteBatchBody, listQuery } from "../../../schema/admin/overview";
```

## Commands

| Task                      | Command                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| **Install deps**          | `pnpm install`                                                            |
| **Dev (all/specific)**    | `pnpm dev` / `pnpm --filter web dev`                                      |
| **Build (all/specific)**  | `pnpm build` / `pnpm --filter api build`                                  |
| **Lint / Format**         | `pnpm lint` / `pnpm format`                                               |
| **Lint fix / Format fix** | `pnpm lint:fix` / `pnpm format:fix`                                       |
| **Test (all/specific)**   | `pnpm test` / `pnpm --filter @openstarter/api test`                       |
| **Test coverage**         | `pnpm test:coverage`                                                      |
| **Type check**            | `pnpm check-types`                                                        |
| **Database**              | `pnpm db:migrate` (local D1) / `pnpm -F @openstarter/api db:migrate:prod` |
| **Services**              | `pnpm services:setup` / `services:start` / `services:stop`                |

## Environment

`apps/web/.env` is the single environment source for the whole monorepo
(copy `apps/web/.env.example`; there is no root `.env`). `apps/web/.env.production.example`
is the production counterpart (same keys, production values): a checklist for
`wrangler.jsonc` vars + `wrangler secret put` on Cloudflare. The web app runs
in workerd everywhere (official `@cloudflare/vite-plugin`), so dev runtime
server vars come from `apps/web/.dev.vars` (copy `.dev.vars.example`), while
build-time `VITE_*` still come from `.env` via Vite. Vite's `.env.development` /
`.env.production` are intentionally unused. Every entry point loads env itself:

- `apps/web` — Vite for the client; the server entry (`src/server.ts`, built
  via `@cloudflare/vite-plugin` with `main: @tanstack/react-start/server-entry`)
  imports `@openstarter/api` directly; `__CF_ENV__` is self-wired inside
  `packages/api/src/db/server.ts` from the official
  `import { env } from "cloudflare:workers"` module (the better-auth server in
  `modules/auth/server.ts` initializes its db adapter at module top level, so
  the binding must exist regardless of import order). Vite `.env` is loaded for
  `VITE_*` at build time; runtime vars come from wrangler `vars`/secrets and
  `.dev.vars` in dev
- `packages/api` — drizzle-kit configs at the package root (`db:generate`
  needs no env; `db:migrate:prod` reads CLOUDFLARE_ACCOUNT_ID /
  CLOUDFLARE_DATABASE_ID / CLOUDFLARE_API_TOKEN injected by CI — see
  apps/web/.env.production.example); the runtime db client
  (`src/db/server.ts`) is D1-only: it reads the `DB` binding from
  `__CF_ENV__` (workerd request env, or the local one set by
  `initLocalD1()` via wrangler `getPlatformProxy`);
  `scripts/seed-admin.ts` (pure Node; calls `initLocalD1()`)
- extension / mobile / mini-app — their build entries (`wxt.config.ts`,
  `scripts/env.mjs`, `config/index.ts`)

The CLI is a standalone package: pass
`OPENSTARTER_API_URL=http://localhost:3000` when running `dev:cli` locally.

Required variables:

- `VITE_APP_URL` — web app origin (also the API origin). Read directly from
  `process.env` by better-auth's `baseURL`, SSR canonical URLs, email links and
  every app's derived API base; missing value falls back to
  `http://localhost:3000` locally. There are no aliases — this is the only key

Database: one D1 binding (`DB`) everywhere — web runs in workerd for dev, build
and deploy (official `@cloudflare/vite-plugin`), so bindings come from
`wrangler.jsonc` directly; only seed scripts (pure Node) spin up a local D1 via
`wrangler.getPlatformProxy` reading `apps/web/wrangler.jsonc` (state in
`apps/web/.wrangler/state/v3`). There is no connection-string env key; tests run
against in-memory miniflare D1 (`src/db/testing`). D1 rejects SQL
`BEGIN`/`SAVEPOINT`, so `db.transaction()` is unavailable — use `db.batch()`
(atomic) or the `d1Transaction` helper from `src/db/server`. The db layer is
internal to the api package (no exports subpath) — only api code can import it.
(non-atomic callback, callers stay idempotent).

Extension / mobile / mini-app / cli / desktop read the web app address from
`apps/web/.env` at build time; `OPENSTARTER_API_URL`
stays available as an explicit override for CI/deployments. See apps/web,
packages/api (server-side: better-auth, payment providers, credits, referral)
and packages/auth (client-side) for app-specific env vars.

## Code Conventions

- **Language**: TypeScript, functional/declarative, no classes
- **Validation**: Zod schemas at system boundaries
- **Naming**: `isLoading`, `hasError`, `handleClick` for booleans/handlers
- **Error handling**: Guard clauses, early returns; structured error responses
- **Immutability**: Never mutate; always return new objects/arrays
- **File organization**: ~200-400 lines per file, max 800
- **API responses**: Consistent envelope (`code`, `message`, `data`, `page`/`total` for pagination)

## Key Patterns

### RPC Type Safety

The API uses Hono RPC for end-to-end type safety:

```ts
// Backend: export the Hono app type
export type AppType = typeof routes;

// Client (web / extension / mobile / mini-app): always go through the pre-typed factory
// in @openstarter/api/client — never `hc<AppType>` + `import type { AppType }` directly.
import { hcWithType } from "@openstarter/api/client";

const client = hcWithType(apiBaseUrl);

// Full autocomplete from schema to UI
const { data } = await client.api.user.orders.$get({ query: { page: "1" } });
```

`@openstarter/api/client` also applies `ApplyGlobalResponse`, so error responses
(`{ code: -1, message }` on 401/403/404/409/422/500) are typed. The web client uses a
relative base (`/`) and falls back to an in-process `app.fetch` bridge on the server
(`apps/web/src/server.ts` + `lib/rpc-bridge.ts`) so SSR loader prefetch carries cookies.

### Better-Auth

- Server setup in `packages/api/src/modules/auth/server.ts` (betterAuth() runs
  at module top level; the api package is the sole db consumer)
- Web client in `packages/auth/src/client/web.ts` (uses fetch/cookies)
- Mobile client in `packages/auth/src/client/native.ts` (@better-auth/expo);
  Taro client in `packages/auth/src/client/taro.ts`
- Shared access-control definitions in `packages/auth/src/rbac/access.ts`
  (`@openstarter/auth/rbac/access` — imported by both the api rbac middleware
  and the web admin client)
- All OAuth, passkey, 2FA configured at init time

### Billing Lifecycle

- `order` — one-time purchases
- `subscription` — recurring (lifecycle: active → canceled → expired)
- `credit` — points with expiration + consumption history (FIFO)
- Webhook handlers in `packages/api/src/modules/billing/payment/`

## Recent Optimizations (Phase 2 & 3)

### Phase 2: Module Reorganization

- Moved top-level service folders into `modules/` for domain cohesion
- Each domain now colocates router + service (e.g., `modules/user/router.ts` + `modules/user/service.ts`)
- Enables isolated testing and clear ownership per domain

### Phase 3: Schema Centralization

- Extracted repeated schemas to `src/schema/shared.ts` (pagination, idParam)
- All domain-specific validation schemas now live under `src/schema/`
  (mirroring `modules/`), alongside the domain value vocabularies they
  consume — routers and services import from `schema/`, never the reverse
- Eliminates schema duplication across modules (e.g., admin/referral router
  and service shared one `manualCreateBody` definition)

## Testing

- **Unit tests** — colocated as `.test.ts` next to source
- **Property tests** — property tests are colocated as `*.property.test.ts` next to the source they cover, written as plain parameterized tests (no extra libraries)
- **Coverage** — CI runs `turbo run test:coverage` (single pass, no separate test job). Repo-level thresholds live in the root `vitest.config.ts` and are intentionally low today (they gate against gross regressions, not a quality bar); the long-term goal is 80%+ for critical paths (auth, billing, api — all three suites run in the `packages/api` vitest project since the auth-server/billing-web merge). UI-component packages (e.g. `packages/ui/web`) are included in the aggregate but largely untested — exclude or test before raising thresholds.
- **docs/** is git-ignored (local-only notes; operations plans included). Do not expect it in CI or a fresh clone.

Run specific test:

```bash
pnpm --filter @openstarter/api test -- path/to/test.test.ts
```

## Deployment

Apps share one Hono backend at `/api/*`. Deploy patterns:

- **Web**: Cloudflare Workers via `@cloudflare/vite-plugin` (`pnpm --filter web deploy`)
- **Desktop**: electron-builder auto-update
- **Mobile**: EAS (Expo Application Services)
- **Extension**: CRX3 (Chrome Web Store)
- **CLI**: npm registry or scoped binary
- **Mini-App**: WeChat MP

Database migrations: drizzle-kit only generates SQL (`db:generate`); applying
runs through wrangler — `pnpm db:migrate` (`wrangler d1 migrations apply DB
--local`) locally and `db:migrate:prod` (drizzle-kit d1-http) against the
cloud database (drizzle-kit config lives in `packages/api`).

## Troubleshooting

| Issue                   | Fix                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Env vars not loaded     | Create `apps/web/.env`; each entry point reads it (see Environment above)             |
| Module resolution fails | `pnpm clean && pnpm install`                                                          |
| Type errors in IDE      | `pnpm check-types`; restart TS server                                                 |
| Tests fail on import    | Verify workspace alias in `tsconfig.json` (check `@openstarter/*` → `packages/*/src`) |
