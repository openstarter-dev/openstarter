# Foundation Quality and Financial Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement one task at a time and requesting-code-review after each task.

**Goal:** Establish enforceable quality gates, restore Settings type safety, and make checkout/webhook/credits/migrations safe before completing the remaining Phase 0–5 features.

**Architecture:** Add a workspace Vitest/fast-check and Ultracite gate first. Billing clients submit only a catalog identifier and provider; the server resolves immutable commercial terms. Persist pending orders before provider calls. PostgreSQL/MySQL use transactions plus provider-scoped unique constraints and a webhook inbox. D1 uses native `D1Database.batch()` with conditional statements and never pretends callback transactions are atomic. Migrations are generated without rewriting tracked schema source.

**Tech stack:** TypeScript 6, Vitest, fast-check, Ultracite/Biome, Hono, Drizzle, Better Auth 1.6, TanStack Start, GitHub Actions.

**Global constraints:** Follow RED → GREEN → REFACTOR. Run each RED command and observe the expected failure before implementation. Pin exact dependency versions. Preserve the uncommitted Settings replacement. Do not commit. At each checkpoint run `git diff --check` and inspect only the listed files.

---

### Task 1: Add the test, lint and CI quality gate

**Files:**
- Modify: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `pnpm-lock.yaml`
- Modify: `apps/web/package.json`
- Modify: `packages/{api,auth,billing,db,email,i18n,shared}/package.json`
- Create: `vitest.config.ts`
- Create: `apps/web/vitest.config.ts`, `apps/web/src/test/setup.ts`
- Create: `packages/{api,auth,billing,db,email,i18n,shared}/vitest.config.ts`
- Create: `.github/workflows/ci.yml`

**Steps:**
1. Query the package registry for exact stable versions of `vitest`, `@vitest/coverage-v8`, `fast-check`, `jsdom`, and `ultracite`; add them as exact root dev dependencies.
2. RED: run `pnpm test`; expect “Missing script: test”. Run `pnpm ultracite:check`; expect “Missing script”.
3. Add a workspace config that discovers package-local `*.test.ts(x)` files. Add root scripts `test`, `test:coverage`, `ultracite:check`; add `test`/`test:coverage` scripts to every listed workspace package so filtered commands are executable; add Turbo tasks with outputs only for coverage.
4. Add one smoke test per environment (node and jsdom) proving aliases resolve.
5. GREEN for this task: run `pnpm test -- --run` and `pnpm ultracite:check`; both pass for the new scaffolding. Run `pnpm check-types` and record that it still fails with exactly the protected eight Settings diagnostics; full typecheck becomes GREEN only in Task 2.
6. Add the executable baseline CI: frozen install → tests/coverage → types → Ultracite → Node/Cloudflare builds. Task 10 extends it with SQLite/Postgres/MySQL service-container migration checks; Task 13 extends it with the bundle budget. Provider fixture tests automatically join the existing test step as Tasks 3–8 add them.
7. Checkpoint: `git diff --check && git diff -- package.json pnpm-workspace.yaml turbo.json vitest.config.ts apps/web/package.json packages/*/package.json .github/workflows/ci.yml`.

### Task 2: Preserve and restore the Settings route implementation

**Files:**
- Modify: `apps/web/src/routes/_app/settings/{accounts,sessions}.tsx`
- Preserve: all files under `apps/web/src/routes/_app/settings/` and deletion of `apps/web/src/routes/_app/settings.tsx`
- Generated: `apps/web/src/routeTree.gen.ts` only through the router generator
- Test: `apps/web/src/routes/_app/settings/settings.test.tsx`

**Steps:**
1. Record `git status --short` and `git diff -- apps/web/src/routes/_app/settings.tsx apps/web/src/routes/_app/settings` as the protected baseline.
2. Add component tests with a mocked auth client for account loading/unlinking and session loading/revocation by token.
3. RED: `pnpm --filter web check-types`; expect the existing eight diagnostics: missing `useListAccounts`/`useListSessions`, wrong revoke argument `id`, implicit `any`, and the unused credential count.
4. Use the Better Auth 1.6 client API: fetch account/session lists with query state managed by TanStack Query or a small typed hook; revoke sessions with `{ token }`; use inferred response element types; render the credential count or remove it.
5. GREEN: `pnpm --filter web test -- settings.test.tsx --run && pnpm --filter web check-types`.
6. Run the route generator/build and confirm all seven Settings routes are present without hand-editing the generated tree.
7. Checkpoint: compare `git status --short` with the baseline; no user file may be removed.

### Task 3: Introduce an immutable server-side plan catalog

**Files:**
- Create: `packages/billing/src/catalog.ts`, `packages/billing/src/catalog.test.ts`
- Modify: `packages/billing/src/index.ts`
- Modify: `apps/web/src/lib/marketing/pricing.ts`
- Modify: `apps/web/src/components/marketing/pricing-section.tsx`

**Interface:**
```ts
interface PlanCatalogEntry {
  id: string;
  active: boolean;
  type: "one_time" | "subscription";
  amount: number;
  currency: string;
  credits: number;
  creditsValidDays: number | null;
  interval: "month" | "year" | null;
  intervalCount: number | null;
  providerPriceIds: Partial<Record<PaymentProviderName, string>>;
}
```

**Steps:**
1. Add property/unit tests: every active ID is unique; terms are positive/coherent; unknown/inactive IDs fail; the public view omits provider secrets.
2. RED: run `pnpm --filter @openstarter/billing test -- catalog.test.ts --run`; expect module-not-found.
3. Implement frozen catalog entries, `resolvePlan(id, provider)`, and a serializable public catalog view. Config may enable entries but cannot accept request-supplied commercial terms.
4. Change marketing data and checkout buttons to use plan IDs/public view only.
5. GREEN: run billing catalog tests and web typecheck.
6. Checkpoint: inspect catalog, exports and pricing diff; no amount/credit value may originate from a form/request body.

### Task 4: Reject checkout tampering at the Hono boundary

**Files:**
- Modify: `packages/api/src/routes/checkout.ts`
- Create: `packages/api/src/routes/checkout.test.ts`
- Modify: `apps/web/src/components/marketing/pricing-section.tsx`

**Steps:**
1. Test authenticated requests for a valid plan, unknown plan, disabled plan, unsupported provider, and bodies attempting to inject `amount`, `currency`, `credits`, `creditsValidDays`, `type`, `interval`, `intervalCount`, or `planName`.
2. RED: run the route test; prove injected values currently reach checkout or are accepted.
3. Replace the body schema with strict `{ planId, provider? }`. Resolve all order terms from the catalog after authentication; construct `PaymentOrder` only from server values.
4. Return 400 for unknown/inactive plans and unsupported provider mappings; do not leak provider configuration.
5. GREEN: injected fields are rejected and captured orders exactly match catalog terms.
6. Checkpoint: `git diff --check` and focused route/billing tests.

### Task 5: Persist orders before external provider calls

**Files:**
- Modify: `packages/billing/src/payment/checkout.ts`, `packages/billing/src/payment/types.ts`
- Modify: three files under `packages/db/src/schema/schema.{sqlite,postgres,mysql}.ts`
- Create: `packages/billing/src/payment/checkout.test.ts`

**Steps:**
1. Test order visibility during a provider callback, provider failure state, retry behavior, and provider-scoped session matching.
2. RED: provider fixture invokes the webhook before returning; expect current “order not found”.
3. Insert a `pending` order with catalog snapshot and provider before network I/O. On success, compare-and-set `pending → created` and store provider session data. On failure, compare-and-set `pending → failed` with a sanitized reason.
4. Match callbacks by both provider and order/session ID. Never match a transaction/session identifier across providers.
5. GREEN: early callback finds the pending order; failure leaves an auditable failed order; retry cannot create duplicate entitlements.
6. Checkpoint focused billing tests and schema diff.

### Task 6: Add provider-scoped uniqueness and webhook inbox models

**Files:**
- Modify: three dialect schema files
- Modify: `packages/billing/src/payment/types.ts`
- Modify: `packages/billing/src/payment/{stripe,paypal,alipay,wechat}.ts`
- Create: provider normalization tests

**Steps:**
1. RED schema tests assert absent unique constraints for `(paymentProvider,paymentSessionId)`, `(paymentProvider,transactionId)`, `(paymentProvider,subscriptionId)`, and webhook `(provider,eventId)`.
2. Add a `payment_event` inbox table with raw hash, type, status, attempts, processed/error timestamps and unique `(provider,eventId)`.
3. Add provider-scoped unique indexes to orders/subscriptions. Normalize each verified provider callback to a stable `eventId` and type.
4. GREEN: schema introspection and provider fixture tests pass for all four providers.
5. Checkpoint: no global uniqueness on external IDs without provider scope.

### Task 7: Make initial-payment webhook processing idempotent and atomic

**Files:**
- Modify: `packages/billing/src/payment/webhook.ts`
- Create: `packages/billing/src/payment/webhook.test.ts`

**Steps:**
1. Test signature-before-parse, unknown order, provider mismatch, replay, and `Promise.all` concurrent delivery of one event.
2. RED: concurrent fixture demonstrates duplicate processing risk or partial state.
3. In one supported transaction: insert inbox event (conflict means successful no-op), claim the eligible order by conditional update, create/update subscription, grant credits, mark order paid, and mark event processed. Errors leave no partial entitlement and permit provider retry.
4. Never trust webhook amount/currency alone; compare them to the persisted catalog snapshot and provider.
5. GREEN: concurrency yields one paid order, at most one subscription mutation, one credit grant and one processed event.
6. Checkpoint focused webhook tests plus typecheck.

### Task 8: Make renewals provider-scoped, idempotent and atomic

**Files:**
- Modify: `packages/billing/src/subscriptions.ts`
- Modify: `packages/billing/src/payment/webhook.ts`
- Create: `packages/billing/src/subscriptions.test.ts`

**Steps:**
1. RED: concurrent renewal callbacks currently pass check-then-insert and can duplicate credit/period updates.
2. Change renewal services to accept a transaction/unit-of-work. Insert renewal order under provider-scoped uniqueness, advance the period conditionally, grant credits and complete inbox event in the same atomic unit.
3. Treat uniqueness conflict for the same verified event as idempotent success; reject mismatched provider/subscription/order terms.
4. GREEN: concurrent replay advances one period and grants credits once; injected failure rolls back all writes.
5. Checkpoint focused subscription/webhook tests.

### Task 9: Replace D1 pseudo-transactions with native atomic batches

**Files:**
- Modify: `packages/db/src/{d1,create-db,types,server}.ts`
- Create: `packages/db/src/d1.test.ts`
- Create: `packages/billing/src/payment/webhook.d1.test.ts`

**Steps:**
1. RED: prove current D1 `transaction(callback)` executes writes despite a later thrown error.
2. Remove the callback transaction compatibility shim for D1. Expose capability detection and native prepared-statement `batch` execution. Calling an unsupported interactive transaction must throw a clear configuration/capability error.
3. Implement D1 financial workflows as one `D1Database.batch()` of conditional statements. Every entitlement write is guarded by the inbox/claimed-order state; any statement failure rolls back the batch.
4. GREEN: a mock D1 batch failing at every possible statement index leaves zero persisted writes; replay succeeds once.
5. Checkpoint DB and D1 billing tests.

### Task 10: Generate and apply real migrations for all dialects

**Files:**
- Create: `packages/db/drizzle.{sqlite,postgres,mysql}.config.ts`
- Modify: `packages/db/package.json`, root `package.json`, `turbo.json`
- Remove/retire behavior: `packages/db/scripts/setup-schema.mjs`
- Create SQL under `packages/db/src/migrations/{sqlite,postgresql,mysql}/`
- Create: `packages/db/src/migrations/migrations.test.ts`

**Steps:**
1. RED: migration test confirms each dialect directory has no executable SQL and current setup rewrites tracked `schema/index.ts`.
2. Configure each dialect directly against its schema file; generation must not mutate source. Add exact generate/check/apply scripts for each dialect.
3. Generate baseline/current migrations including payment inbox and unique constraints.
4. Apply SQLite locally; apply Postgres/MySQL against disposable databases (CI service containers). Query all required tables/indexes after apply.
5. GREEN: run all three migration tests; `git diff -- packages/db/src/schema/index.ts` stays empty during generation.
6. Checkpoint SQL and config diff; migrations are deterministic on a second generation.

### Task 11: Point Wrangler at the real D1 migration directory

**Files:**
- Modify: `apps/web/wrangler.jsonc`
- Modify: deployment docs affected by the old `../../drizzle` path
- Add: CI local Wrangler migration check

**Steps:**
1. RED: path test proves configured `../../drizzle` does not contain migrations.
2. Set `migrations_dir` to the Task 10 SQLite/D1 migration directory and align comments/docs.
3. GREEN: run local Wrangler migration list/apply on a disposable D1 database and `pnpm --filter web cf:build`.
4. Checkpoint wrangler/docs diff.

### Task 12: Exclude TanStack Devtools from production

**Files:**
- Modify: `apps/web/src/routes/__root.tsx`
- Create: `apps/web/src/components/system/devtools.tsx`, `apps/web/src/components/system/devtools.test.tsx`

**Steps:**
1. RED: production build scan finds React Query and Router Devtools chunks/imports.
2. Render a development-only component guarded by `import.meta.env.DEV`; dynamically import both Devtools only inside that development path. Production code has no static Devtools import.
3. GREEN: development test renders tools; production test/build does not. Scan `.output` and fail on Devtools package markers.
4. Checkpoint root/devtools diff.

### Task 13: Enforce a production bundle budget

**Files:**
- Modify: `apps/web/vite.config.ts`, root `package.json`
- Create: `scripts/check-bundle-size.mjs`, `scripts/check-bundle-size.test.ts`

**Steps:**
1. Define enforceable initial budgets: maximum client JS chunk gzip 250 KiB and total initial client JS gzip 350 KiB. The scanner reads the production manifest, not warning text.
2. RED: current build fails because the 568.02 KiB uncompressed main chunk and production Devtools violate the intended split/budget.
3. Enable route automatic code splitting and stable vendor/manual chunks only where measurements justify it; lazy-load optional Settings/admin/provider UI.
4. GREEN: `pnpm build && pnpm bundle:check` passes both limits. CI runs the same scanner.
5. Checkpoint config/script diff and recorded measured sizes.

### Task 14: Run the foundation/financial-safety acceptance gate

**Files:** all files changed in Tasks 1–13.

**Steps:**
1. Run every property test with at least 100 cases and every payment concurrency test repeatedly.
2. Run: `pnpm test`, `pnpm test:coverage`, `pnpm check-types`, `pnpm ultracite:check`.
3. Run all three migration apply checks and D1 batch/Wrapper local migration checks.
4. Run Node build, Cloudflare build and bundle budget.
5. Run `git diff --check` and inspect `git status --short`; verify the original Settings deletion/new-directory semantics remain.
6. Request an independent code review. Resolve every Critical/Important finding and repeat the complete gate.
