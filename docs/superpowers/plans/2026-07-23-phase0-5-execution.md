# OpenStarter Phase 0–5 Completion Execution Plan

> **Execution rule:** Treat `.kiro/specs/shipany-feature-parity/{requirements,design,tasks}.md` as the primary contract. Existing `[x]` marks mean “implementation attempted”, not “accepted”. Every row requires fresh automated evidence. README commitments are additional acceptance requirements.

**Goal:** Complete and verify R1–R28, Correctness Properties 1–55, and README parity commitments while preserving the monorepo + Hono RPC architecture and the user’s uncommitted Settings work.

**Architecture:** Keep the approved dependency DAG: `apps/web → api → auth → {billing,email,i18n} → shared → db`. Platform authorization uses wildcard RBAC only. Team membership remains in Better Auth organization. Client billing requests contain identifiers only; pricing and entitlements are resolved server-side. PostgreSQL/MySQL use real transactions and uniqueness constraints; D1 uses native atomic batch workflows rather than simulated interactive transactions.

**Global gates:** TDD for every behavior change; no production implementation before a failing targeted test. No commit unless explicitly requested. Preserve the Settings baseline (`D apps/web/src/routes/_app/settings.tsx`, `?? apps/web/src/routes/_app/settings/`). External providers use deterministic mocks/fixtures in CI and optional credentialed smoke tests.

## Requirement matrix

| Contract | Current classification | Required closure evidence | Batch |
|---|---|---|---|
| R1 multi-dialect DB/models | partial/regressed: schemas exist; migrations absent; source-rewriting selector | schema parity tests, real SQLite/Postgres/MySQL migration apply, auth-provider property tests | 0–1 |
| R2 runtime config | implemented-unverified | validation/default/secret/round-trip tests; Admin UI integration | 1, 6 |
| R3 shared utilities | implemented-unverified | UUID/snowflake/hash/crypto properties and env error tests | 1 |
| R4 Hono/RPC baseline | partial | 401/403/API-key/RBAC/error-shape route tests and AppType compile test | 1–2 |
| R5 OAuth + first-user init | partial | provider visibility, failure UX, exactly-once credit/role init tests | 2 |
| R6 reset/verification | partial | invalid/expired/enumeration and change/delete-email tests | 2 |
| R7 wildcard RBAC | implemented-unverified | CRUD, wildcard, expiry, unique platform-authority properties | 2 |
| R8 API keys | implemented-unverified | one-time plaintext, hash verification, revoke, redaction tests + Settings UI | 2, 6 |
| R9 invite/trial | implemented-unverified | rejection-sampling, max-use concurrency, expiry, duplicate redemption tests + UI | 2, 6 |
| R10 checkout/providers | unsafe | server catalog, anti-tamper, provider fixtures, pre-persist order tests | 0, 3 |
| R11 subscriptions | unsafe/unverified | lifecycle and provider-scoped uniqueness tests | 0, 3 |
| R12 webhooks | unsafe | signature, inbox, replay/concurrency/rollback/D1 batch tests | 0, 3 |
| R13 credits | unsafe/unverified | FIFO, expiry, insufficient balance, revoke and concurrent conservation properties | 0, 3 |
| R14 CMS posts | implemented-unverified | CRUD/slug/status/soft-delete and Admin UI tests | 4, 6 |
| R15 taxonomy | implemented-unverified | uniqueness/status/relationship tests and Admin UI | 4, 6 |
| R16 blog | implemented-unverified | published-only, locale, slug, pagination and rendering tests | 4 |
| R17 MDX pages | implemented-unverified | frontmatter/render/safe-component/fallback tests | 4 |
| R18 storage | implemented-unverified | S3/R2/base64, validation, failure and delete tests + Settings/Admin UI | 4, 6 |
| R19 AI providers | implemented-unverified | provider selection, config validation, normalized failure tests | 5 |
| R20 AI tasks | unsafe/unverified | credit reserve/settle/refund, callback idempotency and concurrency tests | 5 |
| R21 tickets | implemented-unverified | ownership/RBAC/status/messages/notifications tests + Settings/Admin UI | 5–6 |
| R22 email | implemented-unverified | seven-template locale snapshots, provider fallback and failure logging tests | 6 |
| R23 bilingual i18n | partial | route/cookie/header/user preference, en/zh parity and UI tests | 6 |
| R24 SEO | partial | sitemap/robots/llms/llms-full plus metadata integration tests | 6 |
| R25 analytics | partial | config-driven injection, privacy-safe metrics and Admin dashboard tests | 6 |
| R26 Admin console | missing/partial | RBAC-gated pages for config/users/RBAC/invites/content/orders/subscriptions/credits/tickets/analytics | 6 |
| R27 Settings panel | partial and currently uncommitted | preserve current profile/security/accounts/sessions/danger; add API keys, billing/subscription, credits/payments, tickets | 2, 3, 6 |
| R28 workspace buildability | regressed | clean install, lint, tests, typecheck, Node build, Cloudflare build | 0–6 |
| P1–P55 correctness properties | missing | see the property traceability table below; each ID must be named in a passing fast-check test with at least 100 runs | 1–6 |
| C1 Customer Portal | missing | provider portal abstraction, `/api/billing/portal`, Settings Billing action, Stripe fixture test | 3, 6 |
| C2 Plan Gating | missing | `requirePlan` middleware, route and UI gates, free/trial/active/expired tests | 3, 6 |
| C3 OG/Twitter metadata | missing | absolute locale-aware metadata, stable image asset, head snapshot/build test | 6 |
| C4 CONTRIBUTING | missing | root guide with install/test/lint/type/build/migration/PR workflow | 6 |
| C5 CUSTOMIZE/deploy/ops docs | missing/broken README link | root guide for brand/catalog/providers/DB/SEO/deployment/runbook; link test | 6 |

## Property traceability (P1–P55)

| IDs and required property names | Batch | Target test file(s) | Evidence command |
|---|---|---|---|
| P1 invalid dialect fails; P54 auth adapter follows dialect | 1 | `packages/db/src/adapter.property.test.ts`, `packages/db/src/create-db.property.test.ts` | `pnpm --filter @openstarter/db test -- --run` |
| P2 config write/read round trip; P3 missing config defaults; P4 IDs unique and hash deterministic | 1 | `packages/shared/src/{config,id,hash}.property.test.ts` | `pnpm --filter @openstarter/shared test -- --run` |
| P5 protected endpoints reject invalid credentials; P6 insufficient permission rejects | 1–2 | `packages/api/src/middleware/auth.property.test.ts`, `rbac.property.test.ts` | `pnpm --filter @openstarter/api test -- --run` |
| P7 OAuth entries equal enabled providers; P8 invalid/expired reset rejected; P9 reset prevents enumeration | 2 | `packages/auth/src/oauth.property.test.ts`, `reset-password.property.test.ts` | `pnpm --filter @openstarter/auth test -- --run` |
| P10 resource wildcard grants prefix; P11 global wildcard grants all; P12 expired role contributes nothing; P55 platform authorization only uses wildcard RBAC | 2 | `packages/auth/src/rbac/{matcher,service}.property.test.ts` | `pnpm --filter @openstarter/auth test -- --run` |
| P13 API-key create/verify/revoke round trip; P14 list exposes prefix only | 2 | `packages/auth/src/apikeys/service.property.test.ts` | `pnpm --filter @openstarter/auth test -- --run` |
| P15 invite batch count/fields; P16 invite charset/length/unbiased; P17 redemption count/trial date; P18 invalid/expired/exhausted rejected; P19 repeated redemption idempotent | 2 | `packages/auth/src/invite-codes/service.property.test.ts` | `pnpm --filter @openstarter/auth test -- --run` |
| P20 plan status; P21 checkout persists provider/session; P22 disabled provider rejected; P23 cancellation records time/status; P24 bad webhook signature rejected; P25 webhook replay idempotent | 0, 3 | `packages/billing/src/{catalog,subscriptions}.property.test.ts`, `payment/{checkout,webhook}.property.test.ts` | `pnpm --filter @openstarter/billing test -- --run` |
| P26 credit expiry calculation; P27 balance counts active batches; P28 FIFO/detail conservation; P29 insufficient balance leaves state unchanged; P30 consume/revoke restores | 0, 3 | `packages/billing/src/credits.property.test.ts` | `pnpm --filter @openstarter/billing test -- --run` |
| P31 published posts visible only; P32 slug conflicts rejected; P33 type/status filtering; P34 taxonomy filter/sort; P35 category blog contains published members; P36 absent/unpublished post returns 404 | 4 | `packages/api/src/content/{posts,taxonomy,blog}.property.test.ts` | `pnpm --filter @openstarter/api test -- --run` |
| P37 base64 fallback round trip; P38 oversized upload rejected | 4 | `packages/api/src/storage/service.property.test.ts` | `pnpm --filter @openstarter/api test -- --run` |
| P39 AI task creation atomically consumes; P40 insufficient credits rolls back task; P41 failure revokes; P42 success retains; P43 pagination/filter consistency | 5 | `packages/api/src/ai-tasks/service.property.test.ts` | `pnpm --filter @openstarter/api test -- --run` |
| P44 ticket creation yields open + first user message; P45 status transitions; P46 access isolation | 5 | `packages/api/src/tickets/service.property.test.ts` | `pnpm --filter @openstarter/api test -- --run` |
| P47 email renders in user language | 6 | `packages/email/src/templates.property.test.tsx` | `pnpm --filter @openstarter/email test -- --run` |
| P48 en/zh message key sets match | 6 | `packages/i18n/src/messages.property.test.ts` | `pnpm --filter @openstarter/i18n test -- --run` |
| P49 sitemap contains published posts only | 6 | `packages/api/src/seo/service.property.test.ts` | `pnpm --filter @openstarter/api test -- --run` |
| P50 analytics script is conditionally injected | 6 | `apps/web/src/components/system/analytics.property.test.tsx` | `pnpm --filter web test -- --run` |
| P51 Admin permission guard; P52 Admin entries filtered by permission; P53 Settings login guard | 6 | `apps/web/src/routes/{admin,settings}.property.test.tsx` | `pnpm --filter web test -- --run` |

## Execution batches

### Batch 0 — Quality and financial safety
Execute `2026-07-23-foundation-quality-financial-safety.md`. This establishes Vitest/fast-check/Ultracite/CI, fixes the eight Settings diagnostics, removes client-controlled pricing, closes order/webhook races, implements provider-scoped idempotency, replaces D1 pseudo-transactions, generates real migrations, fixes Wrangler paths, and removes production Devtools/bundle regressions.

### Batch 1 — Foundation acceptance
Add missing Property tests for R1–R4/R28; verify schema parity and config/shared/API contracts. Required evidence: `pnpm test -- --project db --project shared --project api`, three-dialect migration matrix, `pnpm check-types`, `pnpm ultracite:check`.

### Batch 2 — Auth and access control
Complete Properties for R5–R9, first-user exactly-once initialization, Settings API-key flows, invite/trial UI, and platform RBAC middleware. Evidence includes authenticated Hono integration tests and Better Auth route fixtures.

### Batch 3 — Monetization
Complete R10–R13 after Batch 0 hardening; add Customer Portal and Plan Gating. Verify Stripe/PayPal/Alipay/WeChat normalized fixtures, signature checks, subscription lifecycle, FIFO credit conservation and concurrent webhook processing.

### Batch 4 — Content and media
Complete R14–R18 properties, public Blog/MDX rendering, S3/R2/base64 behavior, and content/storage Admin pages. Verify published-only visibility, locale routing, storage validation and soft-delete behavior.

### Batch 5 — AI and support
Complete R19–R21 with deterministic AI provider fixtures, atomic credit reserve/refund behavior, callback idempotency, ticket ownership/RBAC, messages and notification integration.

### Batch 6 — Platform UI, operations and docs
Complete R22–R27, all Admin and Settings surfaces, bilingual parity, SEO/OG/Twitter, analytics, CONTRIBUTING, CUSTOMIZE, deployment and operations documentation. Remove all production Devtools and enforce bundle budgets.

## Final acceptance commands

Run from the isolated worktree and retain output as completion evidence:

```bash
git diff --check
pnpm install --frozen-lockfile
pnpm test
pnpm test:coverage
pnpm check-types
pnpm ultracite:check
pnpm db:migrate:test:sqlite
pnpm db:migrate:test:postgres
pnpm db:migrate:test:mysql
pnpm --filter web cf:build
pnpm build
pnpm bundle:check
pnpm docs:check
git status --short
```

Completion requires: every matrix row mapped to concrete passing output; no skipped/disabled/focused tests; all 55 properties named and passing; both Node and Cloudflare builds passing; real migrations applied for all dialects; Settings baseline retained; independent code review reports no Critical/Important findings.
