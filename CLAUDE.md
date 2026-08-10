# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

openstarter is a production-ready full-stack SaaS starter built with:
- **Monorepo**: Turborepo + pnpm workspaces
- **Framework**: TanStack Start + TanStack Router (web)
- **Backend**: Hono RPC API mounted at `/api/*`
- **Database**: Drizzle ORM (SQLite/Turso/Postgres/MySQL)
- **Multi-platform**: Web, Desktop (Electron), Mobile (Expo), Browser Extension (WXT), CLI, Mini-App (Taro)
- **Auth**: Better-Auth with OAuth, passkey, 2FA, organizations
- **Billing**: Stripe/PayPal/Alipay/WeChat Pay with credit system
- **i18n**: inlang/Paraglide
- **Testing**: Vitest + fast-check
- **Linting**: Biome

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
│   ├── api/               # Hono RPC backend (see API Architecture below)
│   ├── auth/              # Better-Auth server + clients (web.ts, mobile.ts)
│   ├── billing/           # Billing logic (shared, web, mobile providers)
│   ├── db/                # Drizzle schema, migrations, seed scripts
│   ├── email/             # React Email templates + providers (Resend, Cloudflare)
│   ├── i18n/              # Translations + locale utils
│   ├── shared/            # Constants, validators, utilities, logger
│   ├── storage/           # S3/R2 storage abstractions
│   ├── analytics/         # Event tracking (web, mobile, extension variants)
│   ├── monitoring/        # Error tracking (web, mobile, extension variants)
│   ├── notifications/     # Notification providers
│   └── ui/                # shadcn components, Tailwind (web, mobile variants)
│
└── tooling/               # ESLint, Prettier, TypeScript, Vitest configs
```

## API Architecture (`packages/api/`)

The API is organized as modular domains under `src/modules/`, with each domain following a consistent structure:

```
src/
├── index.ts               # Hono app entry, route composition root
├── middleware/            # Auth, RBAC, plan gating middleware
├── schema/                # Shared Zod validation schemas (pagination, id param)
└── modules/               # Domain modules (routers + services colocated)
    ├── ai/                # AI generation (Replicate/Fal providers)
    ├── ai-tasks/          # AI task lifecycle + credit deduction
    ├── auth/              # Better-Auth passthrough + custom unlink-account
    ├── billing/           # Checkout, payment webhooks
    ├── config/            # Public config endpoint
    ├── storage/           # Image upload (S3/R2)
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
├── router.ts              # Hono router (includes route definitions + validation)
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

Shared schemas are centralized in `src/schema/shared.ts`:
- `idParam` — standard ID parameter schema
- `paginationSchema` — default pagination (page + pageSize)
- `createPaginationSchema(max, default)` — custom pagination

Routers extend these with domain-specific fields:
```ts
const listQuery = paginationSchema.extend({
  status: z.enum(STATUS_VALUES).optional(),
  search: z.string().optional(),
});
```

## Commands

| Task | Command |
| --- | --- |
| **Install deps** | `pnpm install` |
| **Dev (all/specific)** | `pnpm dev` / `pnpm --filter web dev` |
| **Build (all/specific)** | `pnpm build` / `pnpm --filter api build` |
| **Lint / Format** | `pnpm lint` / `pnpm format` |
| **Lint fix / Format fix** | `pnpm lint:fix` / `pnpm format:fix` |
| **Test (all/specific)** | `pnpm test` / `pnpm --filter @openstarter/api test` |
| **Test coverage** | `pnpm test:coverage` |
| **Type check** | `pnpm check-types` |
| **Database** | `pnpm with-env pnpm -F @workspace/db db:migrate` |
| **Services** | `pnpm services:setup` / `services:start` / `services:stop` |

## Environment

Create `.env` at the repo root with required variables:
- `DATABASE_URL` — SQLite/Postgres/MySQL connection string
- `PRODUCT_NAME` — Used in emails, marketing site
- `URL` — Deployment base URL
- `DEFAULT_LOCALE` — Default i18n locale (e.g., `en-US`)

See apps/web and packages/auth for app-specific env vars.

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

// Client: instantiate the RPC client
const client = hc<AppType>(apiBaseUrl);

// Full autocomplete from schema to UI
const { data } = await client.user.orders.$get({ query: { page: 1 } });
```

### Better-Auth

- Server setup in `packages/auth/src/auth.ts`
- Web client in `packages/auth/src/web.ts` (uses fetch/cookies)
- Mobile client in `packages/auth/src/mobile.ts` (handles RefreshToken lifecycle)
- All OAuth, passkey, 2FA configured at init time

### Billing Lifecycle

- `order` — one-time purchases
- `subscription` — recurring (lifecycle: active → canceled → expired)
- `credit` — points with expiration + consumption history (FIFO)
- Webhook handlers in `packages/api/src/modules/billing/`

## Recent Optimizations (Phase 2 & 3)

### Phase 2: Module Reorganization
- Moved top-level service folders into `modules/` for domain cohesion
- Each domain now colocates router + service (e.g., `modules/user/router.ts` + `modules/user/service.ts`)
- Enables isolated testing and clear ownership per domain

### Phase 3: Schema Centralization
- Extracted repeated schemas to `src/schema/shared.ts` (pagination, idParam)
- Routers now `.extend()` shared schemas instead of duplicating definitions
- Eliminates ~27 lines of boilerplate across modules

## Testing

- **Unit tests** — colocated as `.test.ts` next to source
- **Property tests** — use fast-check for complex logic; see `ai-tasks/service.property.test.ts`
- **Coverage target** — 80%+ for critical paths (auth, billing, api)

Run specific test:
```bash
pnpm --filter @openstarter/api test -- path/to/test.test.ts
```

## Deployment

Apps share one Hono backend at `/api/*`. Deploy patterns:
- **Web**: Vercel (Next.js App Router via TanStack Start), Cloudflare Workers, self-hosted Node
- **Desktop**: electron-builder auto-update
- **Mobile**: EAS (Expo Application Services)
- **Extension**: CRX3 (Chrome Web Store)
- **CLI**: npm registry or scoped binary
- **Mini-App**: WeChat MP

Database migrations run on startup via `@openstarter/db/src/scripts/migrate.ts`.

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Env vars not loaded | Create `.env` at repo root; use `pnpm with-env` for migrations |
| Module resolution fails | `pnpm clean && pnpm install` |
| Type errors in IDE | `pnpm check-types`; restart TS server |
| Tests fail on import | Verify workspace alias in `tsconfig.json` (check `@openstarter/*` → `packages/*/src`) |
