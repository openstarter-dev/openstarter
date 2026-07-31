# Browser Extension App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `apps/extension`, a Chromium-only WXT browser extension that shows a read-only account panel (plan, credits, subscription) by sharing the existing `apps/web` Better Auth session over a Bearer token.

**Architecture:** The popup reads the Better Auth session cookie via `chrome.cookies`, sends it as `Authorization: Bearer <value>` to the existing Hono API (`hc<AppType>`), and renders the response through `@openstarter/ui-web` components. The panel state is a pure function (`deriveState`) fed by injected cookie-read and fetch results, so the core logic is testable without any Chrome API or network mocking framework. The only server-side change is registering Better Auth's `bearer()` plugin so the existing `requireAuth` middleware accepts the forwarded token — no route or middleware code changes.

**Tech Stack:** WXT 0.21.3 + `@wxt-dev/module-react` 1.2.2, React 19 (catalog), TypeScript, Vitest + jsdom (catalog), Tailwind CSS v4 via `@openstarter/ui-web`, Better Auth 1.6.11 `bearer` plugin.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-01-browser-extension-app-design.md` — every requirement below traces back to a section there.
- Chromium only (Chrome/Edge/Brave). No Firefox/Safari manifest, no `browser.*` namespace handling.
- No content scripts, no background service worker, no OAuth/login UI inside the extension.
- Do not create `packages/ui/ui-extension` or `packages/auth/src/client/extension.ts` — import `@openstarter/ui-web` and `@openstarter/auth/client/web` directly.
- Do not cache the session token anywhere (no `storage` permission). Read the cookie fresh every time the popup opens.
- manifest permissions: `cookies` only. `host_permissions` derived from `VITE_APP_URL` at build time.
- `bearer()` must be registered with `{ requireSignature: true }` and must be inserted **before** `nextCookies()` in the plugins array (`nextCookies()` must remain last — verified against multiple better-auth GitHub issues).
- Do not modify `apps/web` in any way.
- All git commits use Conventional Commits in English (repo convention); code comments may be in Chinese to match repo style, but are not required.
- Every new/modified workspace package must keep `pnpm check-types`, `pnpm lint` (ultracite), and `pnpm test` green.

---

## Task 1: Register the `bearer` plugin on the server

**Files:**
- Modify: `packages/auth/src/server.ts:20-24` (imports), `packages/auth/src/server.ts:125-138` (plugins array)
- Test: `packages/auth/src/bearer-session.test.ts` (new)

**Interfaces:**
- Consumes: nothing new — uses the existing `better-auth/test` `getTestInstance` helper (already used in `packages/auth/src/password-reset.property.test.ts`).
- Produces: `auth` (existing export from `packages/auth/src/server.ts`) now accepts `Authorization: Bearer <session-cookie-value>` on any request. No new exports. `packages/api`'s `requireAuth` middleware (in `packages/api/src/middleware/auth.ts`, unchanged) transparently gains Bearer support because it calls `createAuth().api.getSession({ headers })`.

This is the only task that touches shared/server code. Every later task only adds files under `apps/extension/`.

- [ ] **Step 1: Write the failing integration test**

Create `packages/auth/src/bearer-session.test.ts`:

```typescript
// packages/auth/src/bearer-session.test.ts —— 验证 bearer() 注册后，Better Auth 会话 cookie
// 的值可以直接作为 Authorization: Bearer 请求头认证（浏览器插件端会话桥接的前提）。
// 覆盖 R: docs/superpowers/specs/2026-08-01-browser-extension-app-design.md §3.2/§4。
import { parseSetCookieHeader } from "better-auth/cookies";
import { getTestInstance } from "better-auth/test";
import { beforeAll, describe, expect, it } from "vitest";

const createBearerTestInstance = () =>
  getTestInstance(
    { logger: { disabled: true } },
    { port: 3100, testUser: { email: "bearer-test@example.com" } }
  );

type AuthTestInstance = Awaited<ReturnType<typeof createBearerTestInstance>>;

let instance: AuthTestInstance;

beforeAll(async () => {
  instance = await createBearerTestInstance();
});

describe("bearer plugin session bridging", () => {
  it("accepts the session cookie value as a Bearer token", async () => {
    const signInResponse = await instance.customFetchImpl(
      "http://localhost:3100/api/auth/sign-in/email",
      {
        body: JSON.stringify({
          email: instance.testUser.email,
          password: instance.testUser.password,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }
    );
    const setCookie = signInResponse.headers.get("set-cookie") ?? "";
    const sessionToken = parseSetCookieHeader(setCookie).get(
      "better-auth.session_token"
    )?.value;
    if (!sessionToken) {
      throw new Error("Expected a session token cookie after sign-in");
    }

    const response = await instance.customFetchImpl(
      "http://localhost:3100/api/auth/get-session",
      {
        headers: { authorization: `Bearer ${sessionToken}` },
        method: "GET",
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body?.user?.email).toBe(instance.testUser.email);
  });

  it("rejects a request with no Authorization header and no cookie", async () => {
    const response = await instance.customFetchImpl(
      "http://localhost:3100/api/auth/get-session",
      { method: "GET" }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toBeNull();
  });
});
```

Note: `getTestInstance` builds its own minimal `betterAuth()` instance from the options you pass — it does **not** import `packages/auth/src/server.ts`'s pre-configured singleton. This test therefore also passes `plugins: [bearer({ requireSignature: true })]` explicitly once you write it in Step 3, to prove the plugin mechanism in isolation before wiring it into the real singleton. Update the test body to include that plugin:

```typescript
const createBearerTestInstance = () =>
  getTestInstance(
    {
      logger: { disabled: true },
      plugins: [bearer({ requireSignature: true })],
    },
    { port: 3100, testUser: { email: "bearer-test@example.com" } }
  );
```

Add the import at the top of the test file:

```typescript
import { bearer } from "better-auth/plugins";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @openstarter/auth test -- bearer-session`
Expected: FAIL — `bearer` is not yet imported/used correctly, or the assertions fail because the plugin isn't wired (this confirms the test actually exercises the plugin, not a no-op).

- [ ] **Step 3: Register `bearer()` in the real auth singleton**

Read `packages/auth/src/server.ts` lines 1-30 to confirm current imports before editing (imports may have shifted slightly since this plan was written).

Add `bearer` to the `better-auth/plugins` import list:

```typescript
import {
  admin,
  anonymous,
  bearer,
  emailOTP,
  lastLoginMethod,
  magicLink,
  oneTap,
  organization,
  twoFactor,
} from "better-auth/plugins";
```

In the `plugins` array, insert `bearer({ requireSignature: true })` immediately **before** `nextCookies()` (which must stay last):

```typescript
    lastLoginMethod({
      customResolveMethod: (ctx) => LOGIN_METHOD_BY_PATH.get(ctx.path) ?? null,
    }),
    oneTap(),
    expo(),
    // Bearer 转发（浏览器插件端会话桥接，见 docs/superpowers/specs/2026-08-01-browser-extension-app-design.md
    // §3.2/§4）：插件把 web 端的会话 cookie 值原样作为 Authorization: Bearer 头转发；
    // requireSignature: true 拒绝未签名的裸 token，正常路径（真实会话 cookie 值本就带签名）不受影响。
    // 必须在 nextCookies() 之前注册 —— nextCookies() 必须是数组最后一项。
    bearer({ requireSignature: true }),
    nextCookies(),
  ],
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @openstarter/auth test -- bearer-session`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full auth package test suite to check for regressions**

Run: `pnpm --filter @openstarter/auth test`
Expected: PASS — all existing tests (including `password-reset.property.test.ts`, `auth-database-schema.test.ts`) still pass. This confirms `bearer()`'s `before` hook (which only activates when an `authorization` header is present) does not affect cookie-based auth paths.

- [ ] **Step 6: Run the api package test suite to check for regressions**

Run: `pnpm --filter @openstarter/api test`
Expected: PASS — confirms `requireAuth`/`apiKeyAuth` middleware and existing route tests (`auth-accounts.test.ts`, `smoke.test.ts`) are unaffected.

- [ ] **Step 7: Commit**

```bash
git add packages/auth/src/server.ts packages/auth/src/bearer-session.test.ts
git commit -m "feat(auth): register bearer plugin for extension session bridging"
```

---

## Task 2: Scaffold `apps/extension` and wire it into the monorepo

**Files:**
- Create: `apps/extension/package.json`
- Create: `apps/extension/.gitignore`
- Create: `apps/extension/.env.example`
- Create: `apps/extension/wxt.config.ts`
- Create: `apps/extension/tsconfig.json`
- Modify: `package.json:18` (add `dev:extension` script)
- Modify: `turbo.json:9` (add `.output/**` to `build.outputs`)
- Modify: `biome.jsonc:9` (add extension output dirs to `files.includes`)

**Interfaces:**
- Consumes: nothing (first extension-specific task).
- Produces: a working `pnpm --filter extension dev` command that starts WXT with a placeholder popup. `VITE_APP_URL` env var convention that Task 3 (lib/env.ts) will consume. `apps/extension` package name is `extension` (matches root scripts `dev:web`/`dev:desktop` pattern of using the bare package name, not the scoped `@openstarter/*` form, matching `apps/web`'s `"name": "web"`).

- [ ] **Step 1: Create `apps/extension/package.json`**

```json
{
  "name": "extension",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip",
    "postinstall": "wxt prepare",
    "check-types": "wxt prepare && tsc --noEmit",
    "test": "vitest --run",
    "test:coverage": "vitest --run --coverage"
  },
  "dependencies": {
    "@openstarter/api": "workspace:*",
    "@openstarter/auth": "workspace:*",
    "@openstarter/ui-web": "workspace:*",
    "better-auth": "catalog:",
    "hono": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@types/chrome": "0.2.3",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "^6.0.1",
    "@wxt-dev/module-react": "1.2.2",
    "jsdom": "29.1.1",
    "typescript": "catalog:",
    "vitest": "4.1.10",
    "wxt": "0.21.3"
  }
}
```

- [ ] **Step 2: Create `apps/extension/.gitignore`**

```
.output
.wxt
node_modules
.env*
!.env.example
.turbo
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 3: Create `apps/extension/.env.example`**

```
# web 应用（同时也是 API）的源。插件由此派生 host_permissions 与 API base URL
VITE_APP_URL=http://localhost:3000
```

- [ ] **Step 4: Create `apps/extension/wxt.config.ts`**

```typescript
import { defineConfig } from "wxt";

// host_permissions 与 API base URL 都由 VITE_APP_URL 派生，二者不会漂移
// （见 docs/superpowers/specs/2026-08-01-browser-extension-app-design.md §5）。
// manifest 支持函数形式（(env) => manifest），故可在构建期读取 process.env。
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: () => {
    const appUrl = process.env.VITE_APP_URL || "http://localhost:3000";
    const origin = new URL(appUrl).origin;
    return {
      name: "OpenStarter Account",
      permissions: ["cookies"],
      host_permissions: [`${origin}/*`],
    };
  },
  srcDir: "src",
});
```

- [ ] **Step 5: Create `apps/extension/tsconfig.json`**

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "verbatimModuleSyntax": true,
    "paths": {
      "@openstarter/ui-web/*": ["../../packages/ui/ui-web/src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 6: Install dependencies**

Run: `pnpm install`
Expected: resolves successfully, `wxt prepare` runs via `postinstall` and creates `apps/extension/.wxt/`.

- [ ] **Step 7: Add root `dev:extension` script**

In `package.json`, add after the `dev:desktop` line:

```json
    "dev:desktop": "turbo -F desktop dev",
    "dev:extension": "turbo -F extension dev",
```

- [ ] **Step 8: Extend `turbo.json` build outputs**

In `turbo.json`, change the `build` task's `outputs`:

```json
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**", "src/routeTree.gen.ts", ".output/**"]
    },
```

(This also fixes an existing gap: `apps/web`'s build output lives in `.output/` too, but was previously missing from `outputs`, so cache hits wouldn't restore it.)

- [ ] **Step 9: Extend `biome.jsonc` file excludes**

In `biome.jsonc`, change `files.includes`:

```json
  "files": {
    "includes": [
      "!!apps/web/src/paraglide",
      "!!apps/web/.output",
      "!!apps/extension/.output",
      "!!apps/extension/.wxt",
      "!!coverage"
    ]
  },
```

- [ ] **Step 10: Verify the dev server starts**

Run: `cp apps/extension/.env.example apps/extension/.env` then `pnpm --filter extension dev` (run with a timeout / in background since this is a persistent dev server — start it, confirm it prints a WXT startup banner with no errors, then stop it).
Expected: WXT starts, prints something like `WXT ... ➜ Local: ...`, no manifest/config errors. Stop the process afterward (this step has no automated pass/fail assertion beyond "does not crash on startup" — a later manual verification task exercises the loaded extension in-browser).

- [ ] **Step 11: Verify types and lint**

Run: `pnpm --filter extension check-types`
Expected: PASS (no source files yet beyond config, so this mainly validates `wxt.config.ts` and `tsconfig.json` themselves).

Run: `pnpm lint`
Expected: PASS or only pre-existing findings unrelated to `apps/extension` (Ultracite's quality gate only checks changed files per `scripts/check-quality.mjs`).

- [ ] **Step 12: Commit**

```bash
git add apps/extension/package.json apps/extension/.gitignore apps/extension/.env.example apps/extension/wxt.config.ts apps/extension/tsconfig.json package.json turbo.json biome.jsonc pnpm-lock.yaml
git commit -m "chore(extension): scaffold apps/extension with WXT"
```

---

## Task 3: `lib/env.ts` — validate `VITE_APP_URL`

**Files:**
- Create: `apps/extension/src/lib/env.ts`
- Test: `apps/extension/src/lib/env.test.ts`
- Create: `apps/extension/vitest.config.ts`
- Create: `apps/extension/src/test/setup.ts`

**Interfaces:**
- Consumes: `import.meta.env.VITE_APP_URL` (string, injected by Vite/WXT at build time).
- Produces:
  ```typescript
  export type EnvResult =
    | { ok: true; appUrl: string; origin: string }
    | { ok: false; reason: string };
  export function resolveEnv(rawAppUrl: string | undefined): EnvResult;
  ```
  Task 6 (`lib/state.ts`) consumes `EnvResult` to produce the `misconfigured` panel state.

- [ ] **Step 1: Create the vitest config**

Create `apps/extension/vitest.config.ts` (mirrors `apps/web/vitest.config.ts`):

```typescript
import viteReact from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [viteReact()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    name: "extension",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

Create `apps/extension/src/test/setup.ts` (mirrors `apps/web/src/test/setup.ts`):

```typescript
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

Add `@testing-library/react` and `@testing-library/dom` to `apps/extension/package.json` devDependencies (needed by the setup file and later component tests):

```json
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing test**

Create `apps/extension/src/lib/env.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { resolveEnv } from "./env";

describe("resolveEnv", () => {
  it("returns ok with the parsed origin for a valid URL", () => {
    const result = resolveEnv("http://localhost:3000");

    expect(result).toEqual({
      appUrl: "http://localhost:3000",
      ok: true,
      origin: "http://localhost:3000",
    });
  });

  it("strips any path from the origin", () => {
    const result = resolveEnv("https://app.example.com/some/path");

    expect(result).toEqual({
      appUrl: "https://app.example.com/some/path",
      ok: true,
      origin: "https://app.example.com",
    });
  });

  it("fails when the value is undefined", () => {
    const result = resolveEnv(undefined);

    expect(result).toEqual({
      ok: false,
      reason: "VITE_APP_URL is not set",
    });
  });

  it("fails when the value is an empty string", () => {
    const result = resolveEnv("");

    expect(result).toEqual({
      ok: false,
      reason: "VITE_APP_URL is not set",
    });
  });

  it("fails when the value is not a valid URL", () => {
    const result = resolveEnv("not-a-url");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("not-a-url");
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter extension test -- env.test`
Expected: FAIL with "Cannot find module './env'" or similar.

- [ ] **Step 4: Write the implementation**

Create `apps/extension/src/lib/env.ts`:

```typescript
// apps/extension/src/lib/env.ts —— 校验 VITE_APP_URL，供 host_permissions（wxt.config.ts，
// Node 侧读 process.env）与运行时 API/Auth base URL（本文件，读 import.meta.env）共用同一变量，
// 避免两处派生逻辑漂移。
// 见 docs/superpowers/specs/2026-08-01-browser-extension-app-design.md §5/§6（misconfigured 态）。

export type EnvResult =
  | { ok: true; appUrl: string; origin: string }
  | { ok: false; reason: string };

export function resolveEnv(rawAppUrl: string | undefined): EnvResult {
  if (!rawAppUrl) {
    return { ok: false, reason: "VITE_APP_URL is not set" };
  }

  try {
    const parsed = new URL(rawAppUrl);
    return { appUrl: rawAppUrl, ok: true, origin: parsed.origin };
  } catch {
    return { ok: false, reason: `VITE_APP_URL is not a valid URL: ${rawAppUrl}` };
  }
}

export function getAppUrl(): EnvResult {
  return resolveEnv(import.meta.env.VITE_APP_URL);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter extension test -- env.test`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/extension/vitest.config.ts apps/extension/src/test/setup.ts apps/extension/src/lib/env.ts apps/extension/src/lib/env.test.ts apps/extension/package.json pnpm-lock.yaml
git commit -m "feat(extension): validate VITE_APP_URL with resolveEnv"
```

---

## Task 4: `lib/session.ts` — read the Better Auth cookie via `chrome.cookies`

**Files:**
- Create: `apps/extension/src/lib/session.ts`
- Test: `apps/extension/src/lib/session.test.ts`

**Interfaces:**
- Consumes: `origin: string` (from `EnvResult.origin`, Task 3), `chrome.cookies.get` (injected as a parameter, not called directly, so this module is testable without mocking the global `chrome` object).
- Produces:
  ```typescript
  export type CookieReader = (
    origin: string,
    name: string
  ) => Promise<{ value: string } | null>;

  export async function readSessionToken(
    origin: string,
    cookieReader: CookieReader
  ): Promise<string | null>;

  export function chromeCookieReader(): CookieReader;
  ```
  Task 5 (`lib/auth-client.ts`) and Task 6 (`lib/api.ts`) consume `readSessionToken` to build the `Authorization` header. Task 8 (popup) wires `chromeCookieReader()` as the real `CookieReader` implementation.

- [ ] **Step 1: Write the failing test**

Create `apps/extension/src/lib/session.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

import { readSessionToken } from "./session";

const ORIGIN = "http://localhost:3000";

describe("readSessionToken", () => {
  it("returns the value of the __Secure- prefixed cookie when present", async () => {
    const cookieReader = vi.fn(async (_origin: string, name: string) => {
      if (name === "__Secure-turbostarter.session_token") {
        return { value: "secure-token-value" };
      }
      return null;
    });

    const token = await readSessionToken(ORIGIN, cookieReader);

    expect(token).toBe("secure-token-value");
    expect(cookieReader).toHaveBeenCalledWith(
      ORIGIN,
      "__Secure-turbostarter.session_token"
    );
  });

  it("falls back to the unprefixed cookie when the secure variant is absent", async () => {
    const cookieReader = vi.fn(async (_origin: string, name: string) => {
      if (name === "turbostarter.session_token") {
        return { value: "plain-token-value" };
      }
      return null;
    });

    const token = await readSessionToken(ORIGIN, cookieReader);

    expect(token).toBe("plain-token-value");
  });

  it("prefers the __Secure- cookie when both are present", async () => {
    const cookieReader = vi.fn(async (_origin: string, name: string) => {
      if (name === "__Secure-turbostarter.session_token") {
        return { value: "secure-token-value" };
      }
      if (name === "turbostarter.session_token") {
        return { value: "plain-token-value" };
      }
      return null;
    });

    const token = await readSessionToken(ORIGIN, cookieReader);

    expect(token).toBe("secure-token-value");
  });

  it("returns null when neither cookie is present", async () => {
    const cookieReader = vi.fn(async () => null);

    const token = await readSessionToken(ORIGIN, cookieReader);

    expect(token).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter extension test -- session.test`
Expected: FAIL with "Cannot find module './session'".

- [ ] **Step 3: Write the implementation**

Create `apps/extension/src/lib/session.ts`:

```typescript
// apps/extension/src/lib/session.ts —— 从 web 端域下的 Better Auth 会话 cookie 中取出 token。
// 不缓存：每次调用都现读 cookie jar（见 spec §3.2 "不缓存 token"）。
// cookie 名解析顺序：先试 HTTPS 下的 __Secure- 前缀变体，再回退到无前缀名
// （advanced.cookiePrefix: "turbostarter" → packages/auth/src/server.ts）。

const COOKIE_NAME = "turbostarter.session_token";
const SECURE_COOKIE_NAME = `__Secure-${COOKIE_NAME}`;

export type CookieReader = (
  origin: string,
  name: string
) => Promise<{ value: string } | null>;

export async function readSessionToken(
  origin: string,
  cookieReader: CookieReader
): Promise<string | null> {
  const secure = await cookieReader(origin, SECURE_COOKIE_NAME);
  if (secure) {
    return secure.value;
  }

  const plain = await cookieReader(origin, COOKIE_NAME);
  return plain ? plain.value : null;
}

export function chromeCookieReader(): CookieReader {
  return async (origin, name) => {
    const cookie = await chrome.cookies.get({ url: origin, name });
    return cookie ? { value: cookie.value } : null;
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter extension test -- session.test`
Expected: PASS (4 tests)

- [ ] **Step 5: Verify types (chrome global is recognized)**

Run: `pnpm --filter extension check-types`
Expected: PASS — `@types/chrome` (added in Task 2) provides the `chrome.cookies.get` typing used in `chromeCookieReader`.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/src/lib/session.ts apps/extension/src/lib/session.test.ts
git commit -m "feat(extension): read Better Auth session cookie via chrome.cookies"
```

---

## Task 5: `lib/auth-client.ts` and `lib/api.ts` — typed clients with Bearer auth

**Files:**
- Create: `apps/extension/src/lib/auth-client.ts`
- Create: `apps/extension/src/lib/api.ts`
- Test: `apps/extension/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `readSessionToken` + `CookieReader` (Task 4), `EnvResult` (Task 3).
- Produces:
  ```typescript
  // auth-client.ts
  export function createExtensionAuthClient(
    origin: string,
    cookieReader: CookieReader
  ): ReturnType<typeof createAuthClient>;

  // api.ts
  export function createExtensionApiClient(
    origin: string,
    cookieReader: CookieReader
  ): ReturnType<typeof hc<AppType>>;
  ```
  Task 6 (`lib/state.ts`) and Task 8 (popup) consume both factories.

Both clients need the same "fetch the token, prefix with `Bearer `" header logic. Rather than duplicating it, factor it into a small shared helper in `api.ts` and reuse it from `auth-client.ts`.

- [ ] **Step 1: Write the failing test**

Create `apps/extension/src/lib/api.test.ts`. This test verifies the header-building logic without hitting a real network — it constructs the client, then inspects the resolved `Authorization` header value via the injected cookie reader.

```typescript
import { describe, expect, it, vi } from "vitest";

import { buildAuthHeader } from "./api";

describe("buildAuthHeader", () => {
  it("returns a Bearer header when a token is present", async () => {
    const cookieReader = vi.fn(async () => ({ value: "abc.def" }));

    const headers = await buildAuthHeader("http://localhost:3000", cookieReader);

    expect(headers).toEqual({ Authorization: "Bearer abc.def" });
  });

  it("returns an empty headers object when no token is present", async () => {
    const cookieReader = vi.fn(async () => null);

    const headers = await buildAuthHeader("http://localhost:3000", cookieReader);

    expect(headers).toEqual({});
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter extension test -- api.test`
Expected: FAIL with "Cannot find module './api'" (or `buildAuthHeader is not exported`).

- [ ] **Step 3: Write `lib/api.ts`**

```typescript
// apps/extension/src/lib/api.ts —— 类型化 Hono RPC 客户端，携带 Bearer 会话头。
// 与 apps/web/src/lib/api.ts 的差异只有两点：绝对 base URL（插件跑在
// chrome-extension:// 源，不能靠相对路径）+ 显式 Authorization 头（无法依赖同源 cookie）。
// 见 spec §3.2/§6。

import type { AppType } from "@openstarter/api";
import { hc } from "hono/client";

import type { CookieReader } from "./session";
import { readSessionToken } from "./session";

export async function buildAuthHeader(
  origin: string,
  cookieReader: CookieReader
): Promise<Record<string, string>> {
  const token = await readSessionToken(origin, cookieReader);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function createExtensionApiClient(
  origin: string,
  cookieReader: CookieReader
) {
  return hc<AppType>(origin, {
    headers: () => buildAuthHeader(origin, cookieReader),
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter extension test -- api.test`
Expected: PASS (2 tests)

- [ ] **Step 5: Write `lib/auth-client.ts` (no new test — thin composition wired end-to-end in Task 8's manual verification)**

```typescript
// apps/extension/src/lib/auth-client.ts —— 复用 @openstarter/auth/client/web 的插件集合，
// 叠加显式 baseURL（插件跨源，无法像 apps/web 一样靠相对路径）与 Bearer fetchOptions.auth
// （无法依赖同源 cookie，需要显式把 chrome.cookies 读到的会话值当 token 发出）。
// 不新增 packages/auth/src/client/extension.ts —— 差异只在"怎么拿 token"，属 chrome-only
// 代码，不应进入服务端也依赖的 packages/auth（见 spec §3.4）。
import {
  adminClient,
  anonymousClient,
  createAuthClient,
  emailOTPClient,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
  passkeyClient,
  twoFactorClient,
} from "@openstarter/auth/client/web";

import type { CookieReader } from "./session";
import { readSessionToken } from "./session";

export function createExtensionAuthClient(
  origin: string,
  cookieReader: CookieReader
) {
  return createAuthClient({
    baseURL: origin,
    fetchOptions: {
      auth: {
        token: () => readSessionToken(origin, cookieReader).then((t) => t ?? ""),
        type: "Bearer",
      },
    },
    plugins: [
      passkeyClient(),
      magicLinkClient(),
      emailOTPClient(),
      twoFactorClient(),
      anonymousClient(),
      adminClient(),
      organizationClient(),
      lastLoginMethodClient(),
    ],
  });
}
```

- [ ] **Step 6: Run type checks**

Run: `pnpm --filter extension check-types`
Expected: PASS. If `fetchOptions.auth.token` type mismatches (the better-fetch type is `string | Promise<string | undefined> | (() => ...)`), adjust the arrow function to satisfy it exactly as written above (`Promise<string>` via `.then((t) => t ?? "")` matches the `Promise<string | undefined>` member of the union).

- [ ] **Step 7: Commit**

```bash
git add apps/extension/src/lib/api.ts apps/extension/src/lib/api.test.ts apps/extension/src/lib/auth-client.ts
git commit -m "feat(extension): add Bearer-authenticated API and auth clients"
```

---

## Task 6: `lib/state.ts` — the pure panel state machine

**Files:**
- Create: `apps/extension/src/lib/state.ts`
- Test: `apps/extension/src/lib/state.test.ts`

**Interfaces:**
- Consumes: `EnvResult` (Task 3).
- Produces:
  ```typescript
  export type UserPlan = "none" | "trial" | "expired" | "member";

  export type SubscriptionStatusView = {
    hasSubscription: boolean;
    status: string | null;
    planName: string | null;
    nextBillingDate: string | null; // ISO string over the wire, not Date
  };

  export type AccountSnapshot = {
    plan: UserPlan;
    creditsBalance: number;
    subscription: SubscriptionStatusView;
  };

  export type PanelState =
    | { kind: "loading" }
    | { kind: "misconfigured"; reason: string }
    | { kind: "signed-out" }
    | { kind: "error"; message: string }
    | { kind: "ready"; data: AccountSnapshot };

  export type EndpointResult<T> =
    | { status: "success"; data: T }
    | { status: "http-error"; httpStatus: number; message: string | null }
    | { status: "network-error" };

  export function deriveState(input: {
    env: EnvResult;
    endpoints: {
      plan: EndpointResult<UserPlan>;
      credits: EndpointResult<number>;
      subscription: EndpointResult<SubscriptionStatusView>;
    };
  }): PanelState;
  ```
  Task 7 (components) and Task 8 (popup) consume `PanelState`, `AccountSnapshot`, `deriveState`. Task 9 (data fetching) produces `EndpointResult<T>` values by calling the API client and classifying the outcome.

Field names in `AccountSnapshot`/`SubscriptionStatusView`/`UserPlan` intentionally mirror `packages/billing/billing-web/src/subscriptions.ts` (`SubscriptionStatusView`) and `packages/auth/src/invite-codes/service.ts` (`UserPlan`) exactly, since the popup renders the same server-shaped data as `apps/web`'s settings pages. `nextBillingDate` is typed as `string | null` here (not `Date`) because it crosses the wire as JSON.

- [ ] **Step 1: Write the failing test**

Create `apps/extension/src/lib/state.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { deriveState } from "./state";
import type { SubscriptionStatusView } from "./state";

const OK_ENV = { appUrl: "http://localhost:3000", ok: true as const, origin: "http://localhost:3000" };
const BAD_ENV = { ok: false as const, reason: "VITE_APP_URL is not set" };

const SUBSCRIPTION: SubscriptionStatusView = {
  hasSubscription: true,
  nextBillingDate: "2026-09-01T00:00:00.000Z",
  planName: "Pro",
  status: "active",
};

describe("deriveState", () => {
  it("returns misconfigured when the env is invalid, before checking endpoints", () => {
    const state = deriveState({
      endpoints: {
        credits: { data: 10, status: "success" },
        plan: { data: "member", status: "success" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: BAD_ENV,
    });

    expect(state).toEqual({ kind: "misconfigured", reason: "VITE_APP_URL is not set" });
  });

  it("returns signed-out when any endpoint responds 401", () => {
    const state = deriveState({
      endpoints: {
        credits: { data: 10, status: "success" },
        plan: { httpStatus: 401, message: null, status: "http-error" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: OK_ENV,
    });

    expect(state).toEqual({ kind: "signed-out" });
  });

  it("returns error with the server message for a non-401 HTTP error", () => {
    const state = deriveState({
      endpoints: {
        credits: { data: 10, status: "success" },
        plan: { httpStatus: 500, message: "Internal Server Error", status: "http-error" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: OK_ENV,
    });

    expect(state).toEqual({ kind: "error", message: "Internal Server Error" });
  });

  it("falls back to a status-code message when the server sends no message", () => {
    const state = deriveState({
      endpoints: {
        credits: { data: 10, status: "success" },
        plan: { httpStatus: 500, message: null, status: "http-error" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: OK_ENV,
    });

    expect(state).toEqual({ kind: "error", message: "Request failed (500)" });
  });

  it("returns error on a network failure", () => {
    const state = deriveState({
      endpoints: {
        credits: { data: 10, status: "success" },
        plan: { status: "network-error" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: OK_ENV,
    });

    expect(state).toEqual({
      kind: "error",
      message: "Could not reach the OpenStarter server.",
    });
  });

  it("does not partially render: one failing endpoint degrades the whole panel", () => {
    const state = deriveState({
      endpoints: {
        credits: { httpStatus: 500, message: "boom", status: "http-error" },
        plan: { data: "member", status: "success" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: OK_ENV,
    });

    expect(state.kind).toBe("error");
  });

  it("returns ready with the combined snapshot when all endpoints succeed", () => {
    const state = deriveState({
      endpoints: {
        credits: { data: 42, status: "success" },
        plan: { data: "member", status: "success" },
        subscription: { data: SUBSCRIPTION, status: "success" },
      },
      env: OK_ENV,
    });

    expect(state).toEqual({
      data: {
        creditsBalance: 42,
        plan: "member",
        subscription: SUBSCRIPTION,
      },
      kind: "ready",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter extension test -- state.test`
Expected: FAIL with "Cannot find module './state'".

- [ ] **Step 3: Write the implementation**

Create `apps/extension/src/lib/state.ts`:

```typescript
// apps/extension/src/lib/state.ts —— popup 的纯函数状态机。
// 见 spec §6（五态穷举）/§7（错误处理四条约定）。
// 刻意把"读 cookie"和"发请求"的结果作为已分类的输入传入，使这个函数本身
// 不接触 chrome API 或网络，可以在不 mock 任何浏览器全局的情况下测试。
import type { EnvResult } from "./env";

export type UserPlan = "none" | "trial" | "expired" | "member";

export type SubscriptionStatusView = {
  hasSubscription: boolean;
  status: string | null;
  planName: string | null;
  nextBillingDate: string | null;
};

export type AccountSnapshot = {
  plan: UserPlan;
  creditsBalance: number;
  subscription: SubscriptionStatusView;
};

export type PanelState =
  | { kind: "loading" }
  | { kind: "misconfigured"; reason: string }
  | { kind: "signed-out" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: AccountSnapshot };

export type EndpointResult<T> =
  | { status: "success"; data: T }
  | { status: "http-error"; httpStatus: number; message: string | null }
  | { status: "network-error" };

const UNREACHABLE_MESSAGE = "Could not reach the OpenStarter server.";
const UNAUTHORIZED_STATUS = 401;

function endpointError<T>(
  result: EndpointResult<T>
): { kind: "signed-out" } | { kind: "error"; message: string } | null {
  if (result.status === "success") {
    return null;
  }
  if (result.status === "network-error") {
    return { kind: "error", message: UNREACHABLE_MESSAGE };
  }
  if (result.httpStatus === UNAUTHORIZED_STATUS) {
    return { kind: "signed-out" };
  }
  return {
    kind: "error",
    message: result.message ?? `Request failed (${result.httpStatus})`,
  };
}

export function deriveState(input: {
  env: EnvResult;
  endpoints: {
    plan: EndpointResult<UserPlan>;
    credits: EndpointResult<number>;
    subscription: EndpointResult<SubscriptionStatusView>;
  };
}): PanelState {
  if (!input.env.ok) {
    return { kind: "misconfigured", reason: input.env.reason };
  }

  const { plan, credits, subscription } = input.endpoints;

  for (const result of [plan, credits, subscription]) {
    const failure = endpointError(result);
    if (failure) {
      return failure;
    }
  }

  // The loop above guarantees all three succeeded (status === "success"),
  // narrowing each result's `data` field for the object below.
  if (
    plan.status === "success" &&
    credits.status === "success" &&
    subscription.status === "success"
  ) {
    return {
      data: {
        creditsBalance: credits.data,
        plan: plan.data,
        subscription: subscription.data,
      },
      kind: "ready",
    };
  }

  // Unreachable: satisfies TypeScript's control-flow analysis, which cannot
  // otherwise prove exhaustiveness through the loop above.
  return { kind: "error", message: UNREACHABLE_MESSAGE };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter extension test -- state.test`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/state.ts apps/extension/src/lib/state.test.ts
git commit -m "feat(extension): add pure panel state machine"
```

---

## Task 7: Popup components — signed-out, error, and account panel views

**Files:**
- Create: `apps/extension/src/components/signed-out.tsx`
- Create: `apps/extension/src/components/error-state.tsx`
- Create: `apps/extension/src/components/account-panel.tsx`
- Test: `apps/extension/src/components/account-panel.test.tsx`
- Create: `apps/extension/src/styles/globals.css`

**Interfaces:**
- Consumes: `PanelState`, `AccountSnapshot`, `UserPlan`, `SubscriptionStatusView` (Task 6). `@openstarter/ui-web/components/{badge,button,card,skeleton}`.
- Produces:
  ```typescript
  export function SignedOut(props: { onSignIn: () => void }): JSX.Element;
  export function ErrorState(props: { message: string; onRetry: () => void }): JSX.Element;
  export function AccountPanel(props: {
    data: AccountSnapshot;
    user: { name: string; email: string } | null;
    onManage: () => void;
    onSignOut: () => void;
  }): JSX.Element;
  ```
  Task 8 (popup entrypoint) consumes all three and switches on `PanelState.kind` to pick which to render. The `user` prop is spec §6's "顶部用户名/邮箱（来自 `authClient.useSession()`）" requirement — it is `null`-safe because the session fetch runs independently of the three account endpoints and may still be pending or fail without blocking the rest of the panel (see Task 8 Step 5).

- [ ] **Step 1: Create the global stylesheet**

Create `apps/extension/src/styles/globals.css`:

```css
@import "@openstarter/ui-web/globals.css";
```

- [ ] **Step 2: Write the failing test for `AccountPanel`**

Create `apps/extension/src/components/account-panel.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccountPanel } from "./account-panel";
import type { AccountSnapshot } from "../lib/state";

const SNAPSHOT: AccountSnapshot = {
  creditsBalance: 42,
  plan: "member",
  subscription: {
    hasSubscription: true,
    nextBillingDate: "2026-09-01T00:00:00.000Z",
    planName: "Pro",
    status: "active",
  },
};

describe("AccountPanel", () => {
  it("renders the plan, credits balance, and subscription status", () => {
    render(
      <AccountPanel
        data={SNAPSHOT}
        onManage={vi.fn()}
        onSignOut={vi.fn()}
        user={{ email: "user@example.com", name: "Ada" }}
      />
    );

    expect(screen.getByText("member")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("renders without the identity row when user is null", () => {
    render(
      <AccountPanel data={SNAPSHOT} onManage={vi.fn()} onSignOut={vi.fn()} user={null} />
    );

    expect(screen.getByText("member")).toBeInTheDocument();
  });

  it("renders a sign-out warning about the shared web session", () => {
    render(
      <AccountPanel
        data={SNAPSHOT}
        onManage={vi.fn()}
        onSignOut={vi.fn()}
        user={{ email: "user@example.com", name: "Ada" }}
      />
    );

    expect(
      screen.getByText(/also sign you out of the web app/i)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter extension test -- account-panel.test`
Expected: FAIL with "Cannot find module './account-panel'".

- [ ] **Step 4: Write `signed-out.tsx`**

```typescript
// apps/extension/src/components/signed-out.tsx —— 未登录态：引导去 web 端登录。
// 插件内不放登录表单（见 spec §2 登录体验决策）。
import { Button } from "@openstarter/ui-web/components/button";

export function SignedOut(props: { onSignIn: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-muted-foreground text-sm">
        Sign in to the OpenStarter web app to see your account here.
      </p>
      <Button onClick={props.onSignIn} type="button">
        Sign in
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Write `error-state.tsx`**

```typescript
// apps/extension/src/components/error-state.tsx —— 网络/服务端错误态（不含 401，见 lib/state.ts）。
import { Button } from "@openstarter/ui-web/components/button";

export function ErrorState(props: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-destructive text-sm">{props.message}</p>
      <Button onClick={props.onRetry} type="button" variant="outline">
        Retry
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Write `account-panel.tsx`**

```typescript
// apps/extension/src/components/account-panel.tsx —— 已登录态：只读账户面板。
// 字段与 apps/web 的 settings/billing.tsx、settings/credits.tsx 对齐（同一后端投影）。
// 见 spec §6。
import { Badge } from "@openstarter/ui-web/components/badge";
import { Button } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";

import type { AccountSnapshot } from "../lib/state";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString();
}

export function AccountPanel(props: {
  data: AccountSnapshot;
  user: { name: string; email: string } | null;
  onManage: () => void;
  onSignOut: () => void;
}) {
  const { subscription } = props.data;

  return (
    <div className="flex flex-col gap-4 p-4">
      {props.user ? (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-sm">{props.user.name}</span>
          <span className="text-muted-foreground text-xs">
            {props.user.email}
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Plan</span>
            <Badge variant="secondary">{props.data.plan}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Credits</span>
            <span className="font-medium text-sm tabular-nums">
              {props.data.creditsBalance}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              Subscription
            </span>
            <span className="font-medium text-sm">
              {subscription.hasSubscription
                ? subscription.status ?? "—"
                : "No active subscription"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              Next billing date
            </span>
            <span className="font-medium text-sm">
              {formatDate(subscription.nextBillingDate)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={props.onManage} type="button" variant="outline">
        Manage in web app
      </Button>

      <div className="space-y-1">
        <Button onClick={props.onSignOut} type="button" variant="ghost">
          Sign out
        </Button>
        <p className="text-muted-foreground text-xs">
          This will also sign you out of the web app, since the extension
          shares its session.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter extension test -- account-panel.test`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add apps/extension/src/components apps/extension/src/styles
git commit -m "feat(extension): add signed-out, error, and account panel views"
```

---

## Task 8: Popup entrypoint — wire state machine, clients, and components together

**Files:**
- Create: `apps/extension/src/entrypoints/popup/index.html`
- Create: `apps/extension/src/entrypoints/popup/main.tsx`
- Create: `apps/extension/src/entrypoints/popup/app.tsx`
- Test: `apps/extension/src/entrypoints/popup/app.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 3-7 (`getAppUrl`, `chromeCookieReader`, `createExtensionApiClient`, `createExtensionAuthClient`, `deriveState`, `PanelState`, `SignedOut`, `ErrorState`, `AccountPanel`).
- Produces: the popup UI itself — nothing downstream consumes this, it's the leaf of the dependency graph. `App` is exported for the test to render it with injected fakes (not the real `chrome` API).

The `App` component takes its dependencies (API client factory, cookie reader, env) as props with defaults, so the test can override them without touching global `chrome.*` mocks — this keeps the same "inject collaborators" discipline used in `lib/state.ts` all the way up to the top component.

- [ ] **Step 1: Write the failing test**

Create `apps/extension/src/entrypoints/popup/app.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "./app";
import type { AppDeps } from "./app";

const OK_ENV = { appUrl: "http://localhost:3000", ok: true as const, origin: "http://localhost:3000" };

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    env: OK_ENV,
    fetchCredits: vi.fn().mockResolvedValue({ data: 42, status: "success" }),
    fetchPlan: vi.fn().mockResolvedValue({ data: "member", status: "success" }),
    fetchSubscription: vi.fn().mockResolvedValue({
      data: {
        hasSubscription: true,
        nextBillingDate: null,
        planName: "Pro",
        status: "active",
      },
      status: "success",
    }),
    fetchUser: vi
      .fn()
      .mockResolvedValue({ email: "user@example.com", name: "Ada" }),
    onManage: vi.fn(),
    onSignIn: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  };
}

describe("App", () => {
  it("shows the account panel once all endpoints resolve", async () => {
    render(<App deps={makeDeps()} />);

    await waitFor(() => {
      expect(screen.getByText("member")).toBeInTheDocument();
    });
  });

  it("shows the account panel even if fetchUser fails, just without the identity row", async () => {
    render(
      <App deps={makeDeps({ fetchUser: vi.fn().mockResolvedValue(null) })} />
    );

    await waitFor(() => {
      expect(screen.getByText("member")).toBeInTheDocument();
    });
    expect(screen.queryByText("user@example.com")).not.toBeInTheDocument();
  });

  it("shows the misconfigured message when the env is invalid", async () => {
    render(
      <App
        deps={makeDeps({ env: { ok: false, reason: "VITE_APP_URL is not set" } })}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/VITE_APP_URL is not set/i)).toBeInTheDocument();
    });
  });

  it("shows the signed-out view on a 401", async () => {
    render(
      <App
        deps={makeDeps({
          fetchPlan: vi
            .fn()
            .mockResolvedValue({ httpStatus: 401, message: null, status: "http-error" }),
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter extension test -- app.test`
Expected: FAIL with "Cannot find module './app'".

- [ ] **Step 3: Write `app.tsx`**

```typescript
// apps/extension/src/entrypoints/popup/app.tsx —— popup 根组件：拉三个端点、
// 经 deriveState 归一化、渲染对应视图。依赖以 props 注入（AppDeps），
// 使测试可以绕过 chrome.* 与真实网络。
// 见 spec §6（状态机）/§7（错误处理）。
import { useEffect, useState } from "react";

import { AccountPanel } from "../../components/account-panel";
import { ErrorState } from "../../components/error-state";
import { SignedOut } from "../../components/signed-out";
import type { EnvResult } from "../../lib/env";
import type {
  EndpointResult,
  PanelState,
  SubscriptionStatusView,
  UserPlan,
} from "../../lib/state";
import { deriveState } from "../../lib/state";

export type AppDeps = {
  env: EnvResult;
  fetchPlan: () => Promise<EndpointResult<UserPlan>>;
  fetchCredits: () => Promise<EndpointResult<number>>;
  fetchSubscription: () => Promise<EndpointResult<SubscriptionStatusView>>;
  // 顶部用户名/邮箱展示（spec §6）。独立于三个账户端点抓取，允许失败/pending
  // 而不阻塞面板其余部分——因此返回 `null`（失败或未取到）而不是 EndpointResult，
  // 它不参与 deriveState 的"任一失败即整体降级"规则（那条规则只管三个账户端点）。
  fetchUser: () => Promise<{ name: string; email: string } | null>;
  onSignIn: () => void;
  onManage: () => void;
  onSignOut: () => void;
};

async function loadState(deps: AppDeps): Promise<PanelState> {
  if (!deps.env.ok) {
    return { kind: "misconfigured", reason: deps.env.reason };
  }

  const [plan, credits, subscription] = await Promise.all([
    deps.fetchPlan(),
    deps.fetchCredits(),
    deps.fetchSubscription(),
  ]);

  return deriveState({ endpoints: { credits, plan, subscription }, env: deps.env });
}

export function App(props: { deps: AppDeps }) {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [user, setUser] = useState<{ name: string; email: string } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    loadState(props.deps).then((next) => {
      if (!cancelled) {
        setState(next);
      }
    });
    props.deps.fetchUser().then((next) => {
      if (!cancelled) {
        setUser(next);
      }
    });
    return () => {
      cancelled = true;
    };
    // props.deps is expected to be a stable reference from the caller
    // (see main.tsx), matching the single-fetch-per-popup-open design.
  }, [props.deps]);

  if (state.kind === "loading") {
    return <p className="p-6 text-muted-foreground text-sm">Loading...</p>;
  }

  if (state.kind === "misconfigured") {
    return (
      <div className="p-6 text-destructive text-sm">
        Extension is misconfigured: {state.reason}
      </div>
    );
  }

  if (state.kind === "signed-out") {
    return <SignedOut onSignIn={props.deps.onSignIn} />;
  }

  if (state.kind === "error") {
    return (
      <ErrorState
        message={state.message}
        onRetry={() => {
          loadState(props.deps).then(setState);
        }}
      />
    );
  }

  return (
    <AccountPanel
      data={state.data}
      onManage={props.deps.onManage}
      onSignOut={props.deps.onSignOut}
      user={user}
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter extension test -- app.test`
Expected: PASS (3 tests)

- [ ] **Step 5: Write `main.tsx` wiring real dependencies**

This file is the only place that touches the real `chrome.*` API and constructs the real clients — everything else was tested in isolation.

```typescript
// apps/extension/src/entrypoints/popup/main.tsx —— 真实依赖装配（chrome.cookies、
// 真实网络请求、authClient.getSession()），是唯一接触浏览器全局的地方。App 本身在
// app.test.tsx 里已用注入的 fake 依赖测过，这里不重复测状态机逻辑，只是把真实实现接上。
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createExtensionApiClient } from "../../lib/api";
import { createExtensionAuthClient } from "../../lib/auth-client";
import { getAppUrl } from "../../lib/env";
import { chromeCookieReader } from "../../lib/session";
import type { EndpointResult, SubscriptionStatusView, UserPlan } from "../../lib/state";
import { App } from "./app";
import type { AppDeps } from "./app";
import "../../styles/globals.css";

const env = getAppUrl();
const cookieReader = chromeCookieReader();

function endpointResult<T>(
  promise: Promise<Response>,
  extract: (json: unknown) => T
): Promise<EndpointResult<T>> {
  return promise
    .then(async (response) => {
      if (response.ok) {
        const json = await response.json();
        return { data: extract(json), status: "success" as const };
      }
      const json = await response.json().catch(() => null);
      const message =
        json && typeof json === "object" && "message" in json
          ? String((json as { message: unknown }).message)
          : null;
      return {
        httpStatus: response.status,
        message,
        status: "http-error" as const,
      };
    })
    .catch(() => ({ status: "network-error" as const }));
}

function buildDeps(): AppDeps {
  if (!env.ok) {
    return {
      env,
      fetchCredits: () =>
        Promise.resolve({ status: "network-error" }) as Promise<
          EndpointResult<number>
        >,
      fetchPlan: () =>
        Promise.resolve({ status: "network-error" }) as Promise<
          EndpointResult<UserPlan>
        >,
      fetchSubscription: () =>
        Promise.resolve({ status: "network-error" }) as Promise<
          EndpointResult<SubscriptionStatusView>
        >,
      fetchUser: () => Promise.resolve(null),
      onManage: () => undefined,
      onSignIn: () => undefined,
      onSignOut: () => undefined,
    };
  }

  const client = createExtensionApiClient(env.origin, cookieReader);
  const authClient = createExtensionAuthClient(env.origin, cookieReader);

  const openWebPage = (path: string) => {
    chrome.tabs.create({ url: `${env.appUrl}${path}` });
  };

  return {
    env,
    fetchCredits: () =>
      endpointResult(
        client.api.user.credits.$get({ query: {} }),
        (json) => (json as { data: { balance: number } }).data.balance
      ),
    fetchPlan: () =>
      endpointResult(
        client.api.user.plan.$get(),
        (json) => (json as { data: { plan: UserPlan } }).data.plan
      ),
    fetchSubscription: () =>
      endpointResult(
        client.api.user.subscription.$get(),
        (json) => (json as { data: SubscriptionStatusView }).data
      ),
    fetchUser: () =>
      authClient
        .getSession()
        .then(({ data }) =>
          data?.user ? { email: data.user.email, name: data.user.name } : null
        )
        .catch(() => null),
    onManage: () => openWebPage("/settings/profile"),
    onSignIn: () => openWebPage("/login"),
    onSignOut: () => {
      authClient.signOut().finally(() => {
        openWebPage("/login");
      });
    },
  };
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Popup root element (#root) is missing from index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App deps={buildDeps()} />
  </StrictMode>
);
```

- [ ] **Step 6: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>OpenStarter Account</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="width: 320px; margin: 0;">
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Run full extension test suite**

Run: `pnpm --filter extension test`
Expected: PASS — all tests from Tasks 3-8 (env, session, api, state, account-panel, app).

- [ ] **Step 8: Run type checks**

Run: `pnpm --filter extension check-types`
Expected: PASS. If `client.api.user.credits.$get` or similar Hono RPC calls fail to type-check, re-verify the exact call shape against `apps/web/src/routes/_app/settings/credits.tsx` and `billing.tsx` (Task list context already captured these) and adjust `main.tsx` to match precisely — Hono's `hc<AppType>` typing is strict about query/body shapes matching the route's `zValidator` schema.

- [ ] **Step 9: Commit**

```bash
git add apps/extension/src/entrypoints
git commit -m "feat(extension): wire popup entrypoint to state machine and clients"
```

---

## Task 9: CORS probe and manual browser verification

**Files:**
- Modify: `packages/api/src/index.ts` (only if the probe in Step 2 shows CORS is NOT exempted — see Step 3 for the conditional fallback)
- Modify: `packages/auth/src/server.ts` (same condition — tightens `trustedOrigins` alongside the CORS fix)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new (this task is verification, plus a conditional fix).

This task has no automated test — it's the one place the spec (§9) explicitly calls for a manual check with a documented fallback. Do not skip it or assume the fallback is needed without checking first.

- [ ] **Step 1: Start both dev servers and load the extension unpacked**

Per spec §8.4, verification runs against the dev build, not a production build:

```bash
cp apps/extension/.env.example apps/extension/.env
```

Start both as background/long-running processes (each in its own terminal, or via a process manager — both are persistent dev servers that must stay up for the rest of this task):

```bash
pnpm dev:web
pnpm dev:extension
```

Wait for WXT's startup banner, then check `ls apps/extension/.output` to confirm the dev output directory name (WXT names it `chrome-mv3-dev` for `wxt dev`, as opposed to `chrome-mv3` for `wxt build`).

In Chrome: go to `chrome://extensions`, enable Developer Mode, click "Load unpacked", select `apps/extension/.output/chrome-mv3-dev/`.

- [ ] **Step 2: Probe `/api/health` from the popup**

Open the extension popup (click the toolbar icon). Open the popup's DevTools (right-click the popup → Inspect). In the console, run:

```javascript
fetch("http://localhost:3000/api/health").then((r) => r.json()).then(console.log)
```

Expected: either
- (a) `{status: "ok"}` logs with no CORS error in the console — CORS is exempted for extension-origin requests with declared `host_permissions`, as MV3 documentation states. No further action needed for this task; proceed to Step 4.
- (b) a CORS error in the console (`has been blocked by CORS policy`) — proceed to Step 3.

- [ ] **Step 3 (conditional — only if Step 2 showed a CORS error): Add CORS middleware scoped to the extension origin**

Read `packages/api/src/index.ts` in full before editing, to place the middleware correctly relative to the existing route mounts.

Add the `hono/cors` middleware before the route mounts, scoped to the extension's specific ID (found in `chrome://extensions` after loading the unpacked build):

```typescript
import { cors } from "hono/cors";
```

```typescript
app.use(
  "/api/*",
  cors({
    origin: ["chrome-extension://<paste-the-real-extension-id-here>"],
  })
);
```

Re-run the Step 2 probe to confirm the fix. Then also tighten `packages/auth/src/server.ts`'s `trustedOrigins` entry from the bare `"chrome-extension://"` to the same specific ID, per spec §9's guidance that wildcards should only be used for development.

If this step was needed, commit it separately:

```bash
git add packages/api/src/index.ts packages/auth/src/server.ts
git commit -m "fix(api): scope CORS to the extension origin for popup requests"
```

- [ ] **Step 4: Full manual verification pass (spec §8.4)**

With `pnpm dev:web` still running and the extension loaded:

1. Signed out: open the popup → expect the "Sign in" view. Click it → expect a new tab opens to `http://localhost:3000/login`.
2. Sign in on that web tab (any method — email/password is fastest for local dev).
3. Reopen the popup → expect the account panel with real plan/credits/subscription data.
4. Click "Manage in web app" → expect a new tab to `http://localhost:3000/settings/profile`.
5. Click "Sign out" in the popup → expect the web tab, when refreshed, to also show signed-out.
6. Edit `apps/extension/.env` to set `VITE_APP_URL=not-a-real-url`. Stop and restart `pnpm dev:extension` (WXT does not hot-reload `.env` changes into `import.meta.env`), reload the unpacked extension in `chrome://extensions` → expect the "Extension is misconfigured" message, not a network error.
7. Restore `apps/extension/.env` to `VITE_APP_URL=http://localhost:3000` and restart `pnpm dev:extension` again.

Record the outcome of each numbered check in the PR description or commit message body — this plan cannot mark this task's verification as passed without that record, since it is the only non-automated gate in the whole plan.

- [ ] **Step 5: Stop background dev processes**

Stop both `pnpm dev:web` and `pnpm dev:extension`.

---

## Task 10: Final full-repo verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full type check across the monorepo**

Run: `pnpm check-types`
Expected: PASS across all workspaces, including the new `extension` package.

- [ ] **Step 2: Full test suite across the monorepo**

Run: `pnpm test`
Expected: PASS, including `@openstarter/auth`'s new `bearer-session.test.ts` and every `apps/extension` test from Tasks 3-8.

- [ ] **Step 3: Full lint pass**

Run: `pnpm lint`
Expected: PASS (Ultracite's `scripts/check-quality.mjs` checks only files changed since the base branch, so this should cover every file created/modified across all ten tasks).

- [ ] **Step 4: Full build**

Run: `pnpm build`
Expected: PASS, including `apps/extension`'s WXT production build.

- [ ] **Step 5: Confirm no stray files**

Run: `git status --short`
Expected: no untracked files under `apps/extension/` other than `.env` (gitignored — should not appear at all if `.gitignore` from Task 2 is correct) and build artifacts (`.output/`, `.wxt/` — also gitignored, should not appear). If `.env` or `.output`/`.wxt` show up in `git status`, the `.gitignore` from Task 2 has a bug — fix it before considering this plan complete.

- [ ] **Step 6: Final commit if anything above required fixes**

If Steps 1-5 required any fixes, commit them now with a message describing what was fixed (e.g. `fix(extension): resolve type-check error in main.tsx`). If everything passed with no changes needed, there is nothing to commit for this task.
