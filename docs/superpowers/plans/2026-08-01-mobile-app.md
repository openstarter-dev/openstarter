# Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `apps/mobile`, an Expo Managed React Native app (iOS + Android) that serves as openstarter's general-purpose mobile template: email/password + Google/Apple sign-in with secure session persistence, a typed API client, tab navigation, profile, settings, theming, and i18n.

**Architecture:** The app is self-contained — it shares only contracts with the rest of the monorepo: `import type { AppType }` for the typed Hono RPC client, `@openstarter/auth/client/native` for the RN-safe Better Auth client surface, and `@openstarter/i18n`'s message catalog compiled through Paraglide. Session cookies live in `expo-secure-store` via Better Auth's Expo plugin, and `authClient.getCookie()` feeds them into the `hc<AppType>` client. All decision logic (auth gate, provider selection, error mapping, locale resolution) is extracted into pure functions tested under Vitest in a Node environment; screens are verified by a manual checklist.

**Tech Stack:** Expo SDK 57 / React Native 0.86 / React 19.2, Expo Router (file-based, `src/app`), NativeWind 4.1 (Tailwind v3 internally), TanStack Query v5, TanStack Form v1, Better Auth 1.6.11 + `@better-auth/expo`, Paraglide (`@inlang/paraglide-js`, catalog), Vitest 4.1.10, zod 4 (catalog).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-01-mobile-app-design.md` — every requirement below traces back to a section there.
- Expo **Managed** workflow. Never run `expo prebuild`; never commit `ios/` or `android/` directories.
- iOS + Android only. **Do not enable the Expo Web target** — the "no CORS middleware needed" conclusion (spec §5.3) depends on it.
- URL scheme is exactly `openstarter`. Bundle identifier / applicationId is exactly `dev.openstarter.app` on both platforms.
- `expoClient` must be constructed with `cookiePrefix: "openstarter"` — it must match `advanced.cookiePrefix` in `packages/auth/src/server.ts` after Task 2. A mismatch silently breaks session detection.
- `@openstarter/api` is imported **type-only** (`import type { AppType }`) and declared in `devDependencies`. Never a value import.
- Never import `@openstarter/db`, `@openstarter/auth` (root entry or `/server`), `@openstarter/ui-web`, or `@openstarter/shared` (root entry — it depends on `@openstarter/db`).
- Never import zod schemas from `@openstarter/api` at runtime — form schemas are defined inside `apps/mobile`.
- Login methods in v1: email/password + Google + Apple. No passkey, 2FA, anonymous, Magic Link, or Email OTP wiring (plugin slots only).
- Colors must be RN-compatible. `packages/ui/ui-web`'s tokens are `oklch()`, which React Native cannot parse — Task 11 uses the pre-converted hex equivalents.
- Every new message key must be added to **both** `packages/i18n/messages/en.json` and `zh.json`. `packages/i18n/src/messages.property.test.ts` fails the build on key-set mismatch.
- New files must pass Ultracite: no `any`, no non-null assertions (`!`), no `console`, `import type` for types, `type="button"` semantics where applicable, arrow functions over function expressions where the rule applies. `pnpm lint` gates changed files against `.ultracite-baseline.json`.
- Git commits use Conventional Commits in English (repo convention). Code comments may be Chinese, matching repo style.
- Every task ends with `pnpm --filter mobile check-types` green (once `apps/mobile` exists).

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/auth/src/client/native.ts` | Declares which Better Auth client plugin factories are RN-safe (mirrors `client/web.ts`, minus passkey/oneTap) |
| `apps/mobile/app.config.ts` | Expo config: scheme, bundle id, plugins |
| `apps/mobile/metro.config.js` | Monorepo resolution + NativeWind transform |
| `apps/mobile/tailwind.config.js` | Design tokens mirrored from `ui-web` (hex, not oklch) |
| `apps/mobile/src/lib/env.ts` | Validate `EXPO_PUBLIC_API_URL` (pure + accessor) |
| `apps/mobile/src/lib/api-error.ts` | Classify HTTP/network failures; run a request into a discriminated result (pure) |
| `apps/mobile/src/lib/auth-gate.ts` | Session → route group decision (pure) |
| `apps/mobile/src/lib/public-config.ts` | `/api/config/public` → which auth methods to render (pure) |
| `apps/mobile/src/lib/locale.ts` | Device + persisted locale → active locale (pure) |
| `apps/mobile/src/lib/preferences.ts` | Persist theme and locale choices in SecureStore |
| `apps/mobile/src/lib/theme.ts` | Apply the stored theme preference through NativeWind |
| `apps/mobile/src/lib/i18n.ts` | One-time Paraglide locale init + a switch hook |
| `apps/mobile/src/lib/auth-client.ts` | Real Better Auth client (`createAuthClient` + `expoClient`) |
| `apps/mobile/src/lib/api.ts` | Real `hc<AppType>` client with the session cookie header |
| `apps/mobile/src/lib/queries.ts` | TanStack Query hooks over the typed client |
| `apps/mobile/src/components/ui/*` | `button`, `input`, `card`, `badge`, `spinner`, `screen` |
| `apps/mobile/src/app/_layout.tsx` | Providers (Query, theme, locale) + root `Stack` |
| `apps/mobile/src/app/(auth)/*` | Sign-in, sign-up, forgot-password + group gate |
| `apps/mobile/src/app/(tabs)/*` | Home, profile, settings + group gate |

---

## Task 1: Clear the baseline — commit the pending Desktop integration

**Files:**
- Commit (already present, currently uncommitted): `apps/desktop/**`, `scripts/run-desktop.mjs`, `package.json`, `turbo.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: nothing.
- Produces: a clean working tree, so every later task's diff contains only mobile work. This is the "先提交 Desktop 变更再在干净基线开工" decision from the spec's §2 decision table.

There is no test cycle here — this task's deliverable is a clean `git status`, verified in Step 4.

- [ ] **Step 1: Inspect exactly what is uncommitted**

```bash
git status --short
git diff -- package.json turbo.json
```

Expected: `package.json`, `turbo.json`, `pnpm-lock.yaml` modified; `apps/desktop/` and `scripts/run-desktop.mjs` untracked. The `package.json` diff adds `dev:desktop` and `electron` to `pnpm.onlyBuiltDependencies`; the `turbo.json` diff adds the `dev:electron` task.

If `git status` shows anything else modified, stop and ask the user before proceeding — this plan assumes the Desktop work is the only pending change.

- [ ] **Step 2: Verify the Desktop work builds and type-checks before committing it**

```bash
pnpm --filter desktop check-types
```

Expected: PASS. If it fails, fix the failure as part of this commit — do not commit a broken baseline.

- [ ] **Step 3: Stage the Desktop work explicitly and commit**

Stage by name (not `git add .`) so nothing unrelated slips in:

```bash
git add apps/desktop scripts/run-desktop.mjs package.json turbo.json pnpm-lock.yaml
git commit -m "feat(desktop): add Electron shell app with dev runner"
```

- [ ] **Step 4: Confirm the tree is clean**

```bash
git status --short
```

Expected: empty output, or only `docs/superpowers/` entries (the specs/plans directories may hold other in-flight documents — those are fine and out of scope). No entries under `apps/`, `packages/`, or root config files.

---

## Task 2: Rename turbostarter → openstarter across auth config

**Files:**
- Modify: `packages/auth/src/server.ts` (3 literals: `advanced.cookiePrefix`, `appName`, `trustedOrigins`)
- Modify: `docs/superpowers/specs/2026-08-01-browser-extension-app-design.md` (§3.2 cookie names)

**Interfaces:**
- Consumes: nothing.
- Produces: the session cookie is now named `openstarter.session_token` (and `__Secure-openstarter.session_token` over HTTPS). Task 10 depends on this: `expoClient({ cookiePrefix: "openstarter" })` must match. The browser extension's future `lib/session.ts` will also depend on the renamed cookie, which is why its spec is updated in the same commit.

**No new unit test.** This change replaces three configuration string literals; there is no branching logic to exercise. A test asserting `"openstarter" === "openstarter"` would provide no signal. The real gates are the grep in Step 4 and the existing suites in Step 5 — plus the manual sign-in check in Task 15.

**Breaking-change notice — include this in the commit body:** changing `advanced.cookiePrefix` invalidates every existing session. All currently signed-in web users are signed out once. This is intentional and was approved; it is not a regression.

- [ ] **Step 1: Enumerate every occurrence in source**

```bash
grep -rn "turbostarter\|TurboStarter" --include="*.ts" --include="*.tsx" packages apps --exclude-dir=node_modules --exclude-dir=.output
```

Expected output — exactly four hits, three of which get changed:

```
packages/auth/src/rbac/index.ts:5:  // ... TurboStarter ...          <- comment only, DO NOT change
packages/auth/src/server.ts:94:    cookiePrefix: "turbostarter",     <- change
packages/auth/src/server.ts:104:  appName: "TurboStarter",           <- change
packages/auth/src/server.ts:248:    "turbostarter://",               <- change
```

`packages/auth/src/rbac/index.ts:5` is a provenance comment ("恢复 TurboStarter 既有的…"), not configuration. Leave it alone.

- [ ] **Step 2: Rename `cookiePrefix` and `appName`**

In `packages/auth/src/server.ts`, inside the `advanced` block:

```typescript
  advanced: {
    cookiePrefix: "openstarter",
```

And the app name:

```typescript
  appName: "OpenStarter",
```

- [ ] **Step 3: Rename the trusted origin**

In the same file's `trustedOrigins` array, replace the custom scheme entry:

```typescript
  trustedOrigins: [
    "chrome-extension://",
    // 移动端深链回跳（Expo Router scheme，见 apps/mobile/app.config.ts）。
    // 与 expoClient({ scheme: "openstarter" }) 及 cookiePrefix 保持同名。
    "openstarter://",
    /* Needed only for Apple ID authentication */
    "https://appleid.apple.com",
```

- [ ] **Step 4: Verify no configuration occurrences remain**

```bash
grep -rn "turbostarter" --include="*.ts" --include="*.tsx" packages apps --exclude-dir=node_modules --exclude-dir=.output
```

Expected: no output at all (the remaining `TurboStarter` hit in `rbac/index.ts` is capitalised, so this lowercase-only grep should be empty). Then confirm the comment survived:

```bash
grep -rn "TurboStarter" packages/auth/src/rbac/index.ts
```

Expected: the single comment line on line 5.

- [ ] **Step 5: Run the affected test suites**

```bash
pnpm --filter @openstarter/auth test
pnpm --filter @openstarter/api test
```

Expected: PASS for both. If any test asserts the literal `turbostarter`, update that assertion to `openstarter` — the rename is the intended new truth.

- [ ] **Step 6: Update the browser-extension spec's cookie names**

In `docs/superpowers/specs/2026-08-01-browser-extension-app-design.md` §3.2, replace the cookie-name paragraph so it reads:

```markdown
`advanced.cookiePrefix` 配置为 `"openstarter"`，故 cookie 名为 `openstarter.session_token`；HTTPS 下浏览器会使用 `__Secure-openstarter.session_token` 变体。解析顺序：先试带 `__Secure-` 前缀者，未命中再试无前缀者，两者皆无则判定未登录。
```

Then check the rest of that document for any other `turbostarter` occurrence and update it too:

```bash
grep -n "turbostarter" docs/superpowers/specs/2026-08-01-browser-extension-app-design.md
```

Expected after editing: no output.

- [ ] **Step 7: Commit**

```bash
git add packages/auth/src/server.ts docs/superpowers/specs/2026-08-01-browser-extension-app-design.md
git commit -m "refactor(auth)!: rename cookie prefix and app name to openstarter

Renames advanced.cookiePrefix (turbostarter -> openstarter), appName, and the
custom trustedOrigins scheme, and updates the extension spec's cookie names to
match.

BREAKING CHANGE: changing the cookie prefix invalidates all existing sessions.
Every signed-in user is signed out once after this deploys."
```

---

## Task 3: Add the RN-safe Better Auth client surface

**Files:**
- Create: `packages/auth/src/client/native.ts`
- Reference (do not modify): `packages/auth/src/client/web.ts`

**Interfaces:**
- Consumes: `better-auth/react`, `better-auth/client/plugins` — both already dependencies of `@openstarter/auth`. No new packages.
- Produces:
  ```typescript
  export { createAuthClient } from "better-auth/react";
  export {
    adminClient,
    anonymousClient,
    emailOTPClient,
    inferAdditionalFields,
    lastLoginMethodClient,
    magicLinkClient,
    organizationClient,
    twoFactorClient,
  } from "better-auth/client/plugins";
  ```
  Task 10 imports `createAuthClient` from `@openstarter/auth/client/native`. The other exports are unused in v1 — they are the documented plugin slots (spec §4 "扩展位").

Deliberately absent versus `client/web.ts`: `passkeyClient` (browser WebAuthn) and `oneTapClient` (Web-only, needs a construction-time clientId). Adding either to this file would let a mobile screen import a plugin that cannot work on a device.

**No new unit test.** This module is a re-export surface with no logic; `client/web.ts` has no test either, for the same reason. It is gated by `check-types` here and exercised end-to-end by Task 10.

- [ ] **Step 1: Read the web counterpart to keep the two files parallel**

```bash
cat packages/auth/src/client/web.ts
```

Note its structure: a plugins re-export block, then `createAuthClient` from `better-auth/react`.

- [ ] **Step 2: Create `packages/auth/src/client/native.ts`**

```typescript
// packages/auth/src/client/native.ts —— React Native 端可安全使用的 better-auth 客户端面。
// 与同目录 client/web.ts 并列：web.ts 面向浏览器，本文件面向 Expo / React Native。
//
// 与 web.ts 的差异只有"减去"两项，且都是平台原因而非取舍：
//   - passkeyClient：依赖浏览器 WebAuthn（navigator.credentials），RN 无此 API；
//   - oneTapClient：Google One Tap 是 Web 专属，且需构造期传入 clientId。
//
// 刻意不导出 expoClient：它的 peer 依赖（expo-constants / expo-linking /
// expo-network / expo-web-browser）属于移动应用，不应装进服务端也依赖的 packages/auth。
// 由 apps/mobile 自行从 @better-auth/expo/client 组合（见 spec §3.2）。
//
// 导出不等于启用：以下 plugin factory 是留给后续阶段的接线位，apps/mobile 首版只注册 expoClient。
// Spec: docs/superpowers/specs/2026-08-01-mobile-app-design.md §3.2 / §4。

export {
  adminClient,
  anonymousClient,
  emailOTPClient,
  inferAdditionalFields,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";

export { createAuthClient } from "better-auth/react";
```

- [ ] **Step 3: Verify the subpath resolves and types check**

```bash
pnpm --filter @openstarter/auth check-types
```

Expected: PASS. `packages/auth/package.json` maps `"./*"` to `"./src/*.ts"`, so `@openstarter/auth/client/native` resolves to this file — the same mechanism `apps/web` uses for `@openstarter/auth/client/web`.

- [ ] **Step 4: Confirm no server code is reachable from this module**

```bash
grep -n "^import\|^export" packages/auth/src/client/native.ts
```

Expected: only `better-auth/client/plugins` and `better-auth/react`. No `./server`, no `@openstarter/db`, no `./env`. This is the property that keeps Metro from pulling the server graph.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/client/native.ts
git commit -m "feat(auth): add RN-safe native client surface"
```

---

## Task 4: Scaffold `apps/mobile` and wire it into the monorepo

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/.gitignore`
- Create: `apps/mobile/.env.example`
- Create: `apps/mobile/app.config.ts`
- Create: `apps/mobile/eas.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/metro.config.js`
- Create: `apps/mobile/tailwind.config.js`
- Create: `apps/mobile/global.css`
- Create: `apps/mobile/nativewind-env.d.ts`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/src/app/_layout.tsx` (temporary minimal shell)
- Create: `apps/mobile/src/app/index.tsx` (temporary placeholder screen — **deleted in Task 12**)
- Modify: root `package.json` (add `dev:mobile`)
- Modify: `biome.jsonc` (`files.includes`)

**Interfaces:**
- Consumes: `@openstarter/auth` and `@openstarter/i18n` as `dependencies`; `@openstarter/api` as a `devDependencies` type-only source (spec §3.2 dependency table).
- Produces: a bootable Expo app. Package name is `mobile` (bare, matching `apps/web`'s `"name": "web"` and `apps/desktop`'s `"name": "desktop"`, which is what root `turbo -F <name>` filters on). The `EXPO_PUBLIC_API_URL` convention that Task 5 consumes. NativeWind classNames usable in any `.tsx` under `src/`.

The placeholder `src/app/index.tsx` exists so Expo Router has a resolvable initial route before the route groups land. Task 12 deletes it, because `(tabs)/index.tsx` also maps to `/` and two files cannot own the same path.

- [ ] **Step 1: Create `apps/mobile/package.json`**

Expo-managed native dependencies are installed with `npx expo install` in Step 2 (it picks the versions matching the SDK), so they are intentionally absent here:

```json
{
  "name": "mobile",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "paraglide:compile": "paraglide-js compile --project ../../packages/i18n/project.inlang --outdir ./src/paraglide --strategy globalVariable baseLocale",
    "dev": "pnpm paraglide:compile && expo start",
    "android": "pnpm paraglide:compile && expo run:android",
    "ios": "pnpm paraglide:compile && expo run:ios",
    "check-types": "pnpm paraglide:compile && tsc --noEmit",
    "test": "vitest --run",
    "test:coverage": "vitest --run --coverage"
  },
  "dependencies": {
    "@openstarter/auth": "workspace:*",
    "@openstarter/i18n": "workspace:*",
    "@tanstack/react-form": "^1.28.0",
    "@tanstack/react-query": "^5.99.0",
    "better-auth": "catalog:",
    "hono": "catalog:",
    "react": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@inlang/paraglide-js": "catalog:",
    "@openstarter/api": "workspace:*",
    "@types/react": "catalog:",
    "typescript": "catalog:",
    "vitest": "4.1.10"
  }
}
```

Note `"main": "expo-router/entry"` — Expo Router replaces the usual `index.js` entry. There is deliberately **no `build` script**: Expo builds run on EAS, there is no local artifact, and Turbo skips packages without the script (spec §8.1).

- [ ] **Step 2: Install Expo and its native modules**

Run from the repo root:

```bash
pnpm --filter mobile add expo
pnpm --filter mobile exec npx expo install expo-router expo-constants expo-linking expo-network expo-web-browser expo-secure-store expo-localization expo-status-bar react-native react-native-safe-area-context react-native-screens @better-auth/expo
```

`npx expo install` resolves each package to the version matching the installed SDK, which is why this plan does not hardcode those versions. Confirm the resolved SDK afterwards:

```bash
pnpm --filter mobile exec npx expo --version
grep '"expo"' apps/mobile/package.json
```

Expected: `expo` resolves to `~57.x`. If it resolves to a different major, stop and report — the whole plan is written against SDK 57 / RN 0.86.

- [ ] **Step 3: Install NativeWind, pinned to the stable 4.x line**

NativeWind 4.x requires Tailwind **v3** (spec §2 decision table). Determine the exact latest 4.x and pin it:

```bash
npm view nativewind@4 version
npm view tailwindcss@3 version
```

Then install those exact versions (substitute the two numbers the commands printed):

```bash
pnpm --filter mobile add -D nativewind@<version-from-command> tailwindcss@<version-from-command>
```

Do **not** install `nativewind@5` / `tailwindcss@4` here: v5 is still preview.

- [ ] **Step 4: Create `apps/mobile/babel.config.js`**

```javascript
// NativeWind 4 需要两处接线：babel-preset-expo 的 jsxImportSource 指向 nativewind
// （让 className 传到 RN 组件），以及 nativewind/babel preset。
module.exports = (api) => {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

- [ ] **Step 5: Create `apps/mobile/metro.config.js`**

```javascript
// Metro 的 monorepo 解析：apps/mobile 依赖的 @openstarter/* 均不经构建、直接暴露
// ./src/*.ts，因此必须让 Metro 监视仓库根、并能从根 node_modules 解析，
// 同时启用 package exports（@openstarter/* 的 exports map 依赖它）。
// 见 spec §8.2 与 §9（这是本方案最可能卡住的一环，兜底见 spec §9）。
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 6: Create `apps/mobile/global.css` and `apps/mobile/nativewind-env.d.ts`**

`global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`nativewind-env.d.ts`:

```typescript
/// <reference types="nativewind/types" />
```

- [ ] **Step 7: Create `apps/mobile/tailwind.config.js` with the mirrored tokens**

The values below are `packages/ui/ui-web/src/styles/globals.css`'s semantic tokens converted from `oklch()` to hex, because React Native cannot parse `oklch()`. They land exactly on Tailwind's `neutral` ramp, which is the palette shadcn's base theme uses.

```javascript
// 设计 token 镜像自 packages/ui/ui-web/src/styles/globals.css 的 :root / .dark 语义色。
// 那边是 oklch()，React Native 不支持该颜色空间，故此处存等价 hex。
// 唯一权威来源仍是 ui-web 的 globals.css —— 改那边时必须同步改这里（见 spec §9）。
const light = {
  accent: "#f5f5f5",
  "accent-foreground": "#171717",
  background: "#ffffff",
  border: "#e5e5e5",
  card: "#ffffff",
  "card-foreground": "#0a0a0a",
  destructive: "#df2225",
  foreground: "#0a0a0a",
  input: "#e5e5e5",
  muted: "#f5f5f5",
  "muted-foreground": "#737373",
  primary: "#171717",
  "primary-foreground": "#fafafa",
  ring: "#a1a1a1",
  secondary: "#f5f5f5",
  "secondary-foreground": "#171717",
};

const dark = {
  accent: "#404040",
  "accent-foreground": "#fafafa",
  background: "#0a0a0a",
  border: "rgba(255,255,255,0.10)",
  card: "#171717",
  "card-foreground": "#fafafa",
  destructive: "#ff6467",
  foreground: "#fafafa",
  input: "rgba(255,255,255,0.15)",
  muted: "#262626",
  "muted-foreground": "#a1a1a1",
  primary: "#d4d4d4",
  "primary-foreground": "#171717",
  ring: "#737373",
  secondary: "#262626",
  "secondary-foreground": "#fafafa",
};

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ...light,
        dark,
      },
    },
  },
};
```

Usage convention that follows from this shape: light tokens are the base (`bg-background`, `text-foreground`), and dark overrides are addressed through the nested key (`dark:bg-dark-background`, `dark:text-dark-foreground`). Task 11 uses exactly these class names.

- [ ] **Step 8: Create `apps/mobile/app.config.ts`**

```typescript
import type { ExpoConfig } from "expo/config";

// scheme 必须与 packages/auth/src/server.ts 的 trustedOrigins("openstarter://")
// 以及 expoClient({ scheme }) 三处同名，否则 OAuth 深链回跳不会落回应用。
// bundleIdentifier / package 两端取同一值，避免深链与 OAuth 回调配置分叉；
// 该值还必须与服务端 APPLE_APP_BUNDLE_IDENTIFIER 环境变量一致，否则 Apple 登录不通。
const BUNDLE_IDENTIFIER = "dev.openstarter.app";

const config: ExpoConfig = {
  android: {
    edgeToEdgeEnabled: true,
    package: BUNDLE_IDENTIFIER,
  },
  ios: {
    bundleIdentifier: BUNDLE_IDENTIFIER,
    supportsTablet: true,
  },
  name: "OpenStarter",
  orientation: "portrait",
  // expo-secure-store 的 config plugin 是 requireAuthentication 等原生能力的前提；
  // expo-router 插件启用文件式路由。
  plugins: ["expo-router", "expo-secure-store"],
  scheme: "openstarter",
  slug: "openstarter",
  userInterfaceStyle: "automatic",
  version: "0.1.0",
};

export default config;
```

Typed routes (`experiments.typedRoutes`) are intentionally left off: they emit generated types that `tsc --noEmit` would then depend on, which makes `check-types` fail on a fresh clone before the dev server has ever run.

- [ ] **Step 9: Create `apps/mobile/eas.json`**

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    }
  }
}
```

`EXPO_PUBLIC_API_URL` is deliberately not hardcoded here — it comes from `apps/mobile/.env` locally and from EAS environment variables for remote builds, so a committed template never ships someone's LAN address or staging host.

- [ ] **Step 10: Create `apps/mobile/.env.example`**

```
# Web 应用（同时也是 API）的源。移动端所有请求都打到它的 /api/*。
# 真机调试必须填开发机的局域网 IP —— localhost 在设备上指向设备自身，不是你的电脑。
# 模拟器/仿真器上 http://localhost:3000 可用。
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

- [ ] **Step 11: Create `apps/mobile/.gitignore`**

Mirrors `apps/desktop/.gitignore`'s per-app approach (root `.gitignore` stays untouched):

```
/node_modules
.expo
dist
# Paraglide 生成物，每次 dev/check-types 重新编译
/src/paraglide
# Managed 工作流不提交原生工程（expo prebuild 的产物）
/ios
/android
# Environment & local files
.env*
!.env.example
.DS_Store
*.tsbuildinfo
# Logs
*.log
# Turbo
.turbo
```

- [ ] **Step 12: Create `apps/mobile/tsconfig.json`**

Self-contained, matching how `apps/web` and `apps/desktop` each own their tsconfig rather than extending `tsconfig.base.json` (spec §8.2):

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "allowJs": true,
    "checkJs": false,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    "nativewind-env.d.ts",
    ".expo/types/**/*.ts"
  ]
}
```

`verbatimModuleSyntax` enforces `import type` at compile time, which is what keeps the `@openstarter/api` type-only boundary from being broken by an accidental value import. `allowJs` with `checkJs: false` is there for Paraglide's JSDoc-typed `.js` output — the same reason `apps/web` sets it.

- [ ] **Step 13: Create the temporary app shell**

`apps/mobile/src/app/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

import "../../global.css";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`apps/mobile/src/app/index.tsx` — a placeholder that proves NativeWind classes are applied. **Task 12 deletes this file.**

```tsx
import { Text, View } from "react-native";

export default function PlaceholderScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="font-semibold text-foreground text-lg">
        OpenStarter Mobile
      </Text>
    </View>
  );
}
```

- [ ] **Step 14: Add the root `dev:mobile` script**

In root `package.json`, add directly after the `dev:desktop` line:

```json
    "dev:desktop": "turbo -F desktop dev",
    "dev:mobile": "turbo -F mobile dev",
```

- [ ] **Step 15: Extend `biome.jsonc` excludes**

```json
  "files": {
    "includes": [
      "!!apps/web/src/paraglide",
      "!!apps/web/.output",
      "!!apps/mobile/src/paraglide",
      "!!apps/mobile/.expo",
      "!!coverage"
    ]
  },
```

- [ ] **Step 16: Install and compile messages once**

```bash
pnpm install
pnpm --filter mobile paraglide:compile
```

Expected: `apps/mobile/src/paraglide/` is created. Confirm it is ignored by git:

```bash
git status --short apps/mobile
```

Expected: `src/paraglide` does not appear. If it does, Step 11's `.gitignore` has a typo.

- [ ] **Step 17: Type-check**

```bash
pnpm --filter mobile check-types
```

Expected: PASS.

- [ ] **Step 18: Confirm the bundler starts**

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Start the dev server as a background/持久 process (never inline — it does not exit): `pnpm dev:mobile`. Confirm Metro prints its startup banner listing the dev server URL and a QR code, with no resolution errors. Then stop it.

If Metro fails to resolve `@openstarter/auth` or `@openstarter/i18n`, this is the risk called out in spec §9. Try in this order: (a) confirm `unstable_enablePackageExports` is set in `metro.config.js`; (b) add `config.resolver.disableHierarchicalLookup = true`; (c) apply the spec §9 fallback — inline `client/native.ts`'s contents into `apps/mobile/src/lib/`. Record which one was needed.

- [ ] **Step 19: Lint**

```bash
pnpm lint
```

Expected: PASS. Ultracite checks changed files only; if it flags the `.js` config files, confirm they are covered by the repo's existing config-file conventions and fix any real findings (e.g. prefer `node:path` over `path` — already done in Step 5).

- [ ] **Step 20: Commit**

```bash
git add apps/mobile package.json biome.jsonc pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "chore(mobile): scaffold Expo app with Expo Router and NativeWind"
```

(`pnpm-workspace.yaml` is listed only because `pnpm add` may reformat it; if `git status` shows it unchanged, drop it from the `git add`.)

---

## Task 5: `lib/env.ts` — validate `EXPO_PUBLIC_API_URL`

**Files:**
- Create: `apps/mobile/src/lib/env.ts`
- Test: `apps/mobile/src/lib/env.test.ts`
- Create: `apps/mobile/vitest.config.ts`
- Modify: root `vitest.config.ts` (`test.projects`)

**Interfaces:**
- Consumes: `process.env.EXPO_PUBLIC_API_URL` (Expo inlines `EXPO_PUBLIC_*` at build time, so `process.env` access works both on device and in Node tests).
- Produces:
  ```typescript
  export type EnvResult =
    | { ok: true; apiUrl: string }
    | { ok: false; reason: string };

  export function resolveApiUrl(raw: string | undefined): EnvResult;
  export function getEnv(): EnvResult;
  ```
  Task 10 (`lib/api.ts`, `lib/auth-client.ts`) consumes `getEnv()`. Task 12 renders the `ok: false` case as a dedicated configuration-error screen (spec §7 rule 4).

Root `vitest.config.ts` currently lists projects explicitly (`apps/web/vitest.config.ts`, `packages/*/vitest.config.ts`, `packages/*/*/vitest.config.ts`, `scripts/vitest.config.ts`). `apps/mobile` is not covered by any of those globs, so without Step 3 the mobile tests never run under root `pnpm test`.

- [ ] **Step 1: Create `apps/mobile/vitest.config.ts`**

Node environment, not jsdom: every test in this plan covers a pure function. No React Native preset is involved (spec §8.3 explicitly rules out component rendering tests).

```typescript
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    name: "mobile",
  },
});
```

- [ ] **Step 2: Add the project to the root config**

In root `vitest.config.ts`, extend `test.projects`:

```typescript
    projects: [
      "apps/web/vitest.config.ts",
      "apps/mobile/vitest.config.ts",
      "packages/*/vitest.config.ts",
      "packages/*/*/vitest.config.ts",
      "scripts/vitest.config.ts",
    ],
```

Note for whoever lands the browser-extension plan: `apps/extension/vitest.config.ts` is also absent from this array and needs the same one-line addition, otherwise its tests silently do not run under root `pnpm test`.

- [ ] **Step 3: Write the failing test**

Create `apps/mobile/src/lib/env.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { resolveApiUrl } from "./env";

describe("resolveApiUrl", () => {
  it("accepts an absolute http URL", () => {
    expect(resolveApiUrl("http://192.168.1.100:3000")).toEqual({
      apiUrl: "http://192.168.1.100:3000",
      ok: true,
    });
  });

  it("accepts an absolute https URL", () => {
    expect(resolveApiUrl("https://app.example.com")).toEqual({
      apiUrl: "https://app.example.com",
      ok: true,
    });
  });

  it("strips a trailing slash so joined paths never double up", () => {
    expect(resolveApiUrl("https://app.example.com/")).toEqual({
      apiUrl: "https://app.example.com",
      ok: true,
    });
  });

  it("fails when the value is missing", () => {
    expect(resolveApiUrl(undefined)).toEqual({
      ok: false,
      reason: "EXPO_PUBLIC_API_URL is not set",
    });
  });

  it("fails when the value is an empty string", () => {
    expect(resolveApiUrl("")).toEqual({
      ok: false,
      reason: "EXPO_PUBLIC_API_URL is not set",
    });
  });

  it("fails when the value is not a valid absolute URL", () => {
    const result = resolveApiUrl("localhost:3000");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("localhost:3000");
    }
  });

  it("fails when the value is a relative path", () => {
    const result = resolveApiUrl("/api");

    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
pnpm --filter mobile test -- env.test
```

Expected: FAIL with "Cannot find module './env'".

- [ ] **Step 5: Write the implementation**

Create `apps/mobile/src/lib/env.ts`:

```typescript
// apps/mobile/src/lib/env.ts —— 校验 EXPO_PUBLIC_API_URL。
// Expo 只把 EXPO_PUBLIC_ 前缀的变量注入客户端 bundle（构建期内联 process.env 访问），
// 因此这里读 process.env 在设备与 Node 测试下都成立。
//
// 配置缺失/非法必须是一个独立的错误态，而不是退化成"网络错误" —— 否则 fork 该模板的人
// 拿到的只是一个连不上的应用，无从判断是自己没配还是后端挂了（见 spec §5.1 / §7 第 4 条）。
import * as z from "zod";

const apiUrlSchema = z.url();

export type EnvResult =
  | { ok: true; apiUrl: string }
  | { ok: false; reason: string };

export function resolveApiUrl(raw: string | undefined): EnvResult {
  if (!raw) {
    return { ok: false, reason: "EXPO_PUBLIC_API_URL is not set" };
  }

  const parsed = apiUrlSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: `EXPO_PUBLIC_API_URL is not a valid absolute URL: ${raw}`,
    };
  }

  // 去掉末尾斜杠：hc(baseUrl) 拼接路径时会自行加 "/"，
  // 留着会产出 "https://host//api/..." 这种双斜杠 URL。
  return { apiUrl: parsed.data.replace(/\/$/u, ""), ok: true };
}

export function getEnv(): EnvResult {
  return resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
pnpm --filter mobile test -- env.test
```

Expected: PASS (7 tests)

- [ ] **Step 7: Confirm the root runner picks up the new project**

```bash
pnpm test
```

Expected: PASS, and the output includes a `mobile` project with the 7 tests above. If `mobile` does not appear, Step 2 was not applied.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/vitest.config.ts apps/mobile/src/lib/env.ts apps/mobile/src/lib/env.test.ts vitest.config.ts
git commit -m "feat(mobile): validate EXPO_PUBLIC_API_URL"
```

---

## Task 6: `lib/api-error.ts` — classify failures and run typed requests

**Files:**
- Create: `apps/mobile/src/lib/api-error.ts`
- Test: `apps/mobile/src/lib/api-error.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```typescript
  export type ApiFailure =
    | { status: "unauthorized" }
    | { status: "unreachable" }
    | { status: "server-error"; message: string };

  export type ApiResult<TData> =
    | { status: "success"; data: TData }
    | ApiFailure;

  export function extractMessage(body: unknown): string | null;
  export function mapApiError(httpStatus: number, body: unknown): ApiFailure;
  export function runRequest<TData>(
    send: () => Promise<Response>,
    extract: (body: unknown) => TData
  ): Promise<ApiResult<TData>>;
  ```
  Task 10 (`lib/queries.ts`) calls `runRequest`. Task 13 (`(tabs)/index.tsx`) switches on `ApiResult.status` to render. Task 12's screens treat `"unauthorized"` as "sign the user out", never as an error toast.

This module lives apart from `lib/api.ts` on purpose: `api.ts` imports the auth client, which imports `expo-secure-store`, which cannot load in a Node test. Keeping the classification logic here is what makes it testable at all.

`mapApiError`'s output shape mirrors the browser extension's `deriveState` classification (its spec §7) so both clients report the same thing for the same server response.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/lib/api-error.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

import { extractMessage, mapApiError, runRequest } from "./api-error";

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

describe("extractMessage", () => {
  it("reads the message field from the API envelope", () => {
    expect(extractMessage({ code: -1, message: "Boom" })).toBe("Boom");
  });

  it("returns null for an empty message", () => {
    expect(extractMessage({ code: -1, message: "" })).toBeNull();
  });

  it("returns null for a non-object body", () => {
    expect(extractMessage("plain text")).toBeNull();
    expect(extractMessage(null)).toBeNull();
  });

  it("returns null when message is not a string", () => {
    expect(extractMessage({ message: 42 })).toBeNull();
  });
});

describe("mapApiError", () => {
  it("classifies 401 as unauthorized, not as an error", () => {
    expect(mapApiError(401, { code: -1, message: "Unauthorized" })).toEqual({
      status: "unauthorized",
    });
  });

  it("uses the server message for a 500", () => {
    expect(mapApiError(500, { code: -1, message: "Internal Server Error" })).toEqual({
      message: "Internal Server Error",
      status: "server-error",
    });
  });

  it("falls back to a status-code message when the body has none", () => {
    expect(mapApiError(500, null)).toEqual({
      message: "Request failed (500)",
      status: "server-error",
    });
  });

  it("classifies 403 as a server error carrying its message", () => {
    expect(mapApiError(403, { code: -1, message: "Forbidden" })).toEqual({
      message: "Forbidden",
      status: "server-error",
    });
  });
});

describe("runRequest", () => {
  it("extracts data from a successful envelope", async () => {
    const send = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { code: 0, data: { plan: "member" }, message: "ok" }))
    );

    const result = await runRequest(send, (body) => (body as { data: { plan: string } }).data.plan);

    expect(result).toEqual({ data: "member", status: "success" });
  });

  it("maps a 401 response to unauthorized", async () => {
    const send = vi.fn(() => Promise.resolve(jsonResponse(401, { code: -1, message: "Unauthorized" })));

    const result = await runRequest(send, () => "unused");

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("maps a non-JSON error body to a status-code message", async () => {
    const send = vi.fn(() => Promise.resolve(new Response("<html>502</html>", { status: 502 })));

    const result = await runRequest(send, () => "unused");

    expect(result).toEqual({ message: "Request failed (502)", status: "server-error" });
  });

  it("maps a rejected fetch to unreachable", async () => {
    const send = vi.fn(() => Promise.reject(new Error("Network request failed")));

    const result = await runRequest(send, () => "unused");

    expect(result).toEqual({ status: "unreachable" });
  });

  it("maps a malformed success body to unreachable rather than throwing", async () => {
    const send = vi.fn(() => Promise.resolve(new Response("not json", { status: 200 })));

    const result = await runRequest(send, () => "unused");

    expect(result).toEqual({ status: "unreachable" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter mobile test -- api-error.test
```

Expected: FAIL with "Cannot find module './api-error'".

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/lib/api-error.ts`:

```typescript
// apps/mobile/src/lib/api-error.ts —— 把 HTTP / 网络结果归一成判别联合。
//
// 关键约定（与 apps/extension 的状态机同语义，见 spec §7）：
//   1. 后端错误体统一为 { code: -1, message }（packages/api 的 app.onError）；
//   2. 401 归入 "unauthorized" 而不是 "server-error" —— token 过期、会话被吊销、
//      服务端不认，对用户而言都是"没登录"，应引导登录而非弹报错；
//   3. fetch 本身 reject（后端未启动、IP 填错）归 "unreachable"；
//   4. 文案在 UI 层决定：本模块只给判别式，"unreachable" 的措辞由界面本地化。
//
// 本模块刻意不 import lib/api.ts —— 那会拉进 auth-client 与 expo-secure-store，
// 使这里无法在 Node 环境下测试。

const UNAUTHORIZED_STATUS = 401;

export type ApiFailure =
  | { status: "unauthorized" }
  | { status: "unreachable" }
  | { status: "server-error"; message: string };

export type ApiResult<TData> =
  | { status: "success"; data: TData }
  | ApiFailure;

export function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  if (!("message" in body)) {
    return null;
  }
  const { message } = body as { message: unknown };
  return typeof message === "string" && message.length > 0 ? message : null;
}

export function mapApiError(httpStatus: number, body: unknown): ApiFailure {
  if (httpStatus === UNAUTHORIZED_STATUS) {
    return { status: "unauthorized" };
  }
  return {
    message: extractMessage(body) ?? `Request failed (${httpStatus})`,
    status: "server-error",
  };
}

export async function runRequest<TData>(
  send: () => Promise<Response>,
  extract: (body: unknown) => TData
): Promise<ApiResult<TData>> {
  let response: Response;
  try {
    response = await send();
  } catch {
    return { status: "unreachable" };
  }

  if (response.ok) {
    try {
      const body: unknown = await response.json();
      return { data: extract(body), status: "success" };
    } catch {
      // 2xx 但响应体不是预期 JSON：代理返回了 HTML、或 base URL 指向了别的服务。
      // 对用户而言等同于"连不上正确的服务"。
      return { status: "unreachable" };
    }
  }

  const errorBody: unknown = await response.json().catch(() => null);
  return mapApiError(response.status, errorBody);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter mobile test -- api-error.test
```

Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/api-error.ts apps/mobile/src/lib/api-error.test.ts
git commit -m "feat(mobile): classify API failures into a discriminated result"
```

---

## Task 7: `lib/auth-gate.ts` — session to route-group decision

**Files:**
- Create: `apps/mobile/src/lib/auth-gate.ts`
- Test: `apps/mobile/src/lib/auth-gate.test.ts`

**Interfaces:**
- Consumes: the shape of `authClient.useSession()`'s return value — `{ data, isPending }`, where `data` is `null` when signed out and `{ user: { id, ... } }` when signed in.
- Produces:
  ```typescript
  export type AuthGate = "loading" | "authenticated" | "unauthenticated";

  export function deriveAuthGate(input: {
    session: { user?: { id: string } | undefined } | null | undefined;
    isPending: boolean;
  }): AuthGate;
  ```
  Task 12's `(auth)/_layout.tsx` and `(tabs)/_layout.tsx` both call this.

The behaviour that matters most: **a pending session must never resolve to `unauthenticated`.** If it did, an already-signed-in user would see one frame of the sign-in screen on every cold start, and `(tabs)` would redirect away before the SecureStore read finished.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/lib/auth-gate.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { deriveAuthGate } from "./auth-gate";

describe("deriveAuthGate", () => {
  it("is loading while the session is pending, even with no session yet", () => {
    expect(deriveAuthGate({ isPending: true, session: null })).toBe("loading");
  });

  it("is loading while pending even if a session is already present", () => {
    expect(
      deriveAuthGate({ isPending: true, session: { user: { id: "u1" } } })
    ).toBe("loading");
  });

  it("is authenticated when a resolved session carries a user", () => {
    expect(
      deriveAuthGate({ isPending: false, session: { user: { id: "u1" } } })
    ).toBe("authenticated");
  });

  it("is unauthenticated when the resolved session is null", () => {
    expect(deriveAuthGate({ isPending: false, session: null })).toBe(
      "unauthenticated"
    );
  });

  it("is unauthenticated when the resolved session is undefined", () => {
    expect(deriveAuthGate({ isPending: false, session: undefined })).toBe(
      "unauthenticated"
    );
  });

  it("is unauthenticated when the session object has no user", () => {
    expect(deriveAuthGate({ isPending: false, session: {} })).toBe(
      "unauthenticated"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter mobile test -- auth-gate.test
```

Expected: FAIL with "Cannot find module './auth-gate'".

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/lib/auth-gate.ts`:

```typescript
// apps/mobile/src/lib/auth-gate.ts —— 会话状态 → 应该停在哪个路由组。
//
// 唯一容易写错、也最要紧的一条：pending 必须映射到 "loading"，绝不能落到
// "unauthenticated"。否则已登录用户每次冷启动都会闪一帧登录页，
// 且 (tabs) 会在 SecureStore 读完之前把人重定向走（见 spec §4 会话门禁）。

export type AuthGate = "loading" | "authenticated" | "unauthenticated";

export function deriveAuthGate(input: {
  session: { user?: { id: string } | undefined } | null | undefined;
  isPending: boolean;
}): AuthGate {
  if (input.isPending) {
    return "loading";
  }
  return input.session?.user ? "authenticated" : "unauthenticated";
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter mobile test -- auth-gate.test
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/auth-gate.ts apps/mobile/src/lib/auth-gate.test.ts
git commit -m "feat(mobile): derive route group from session state"
```

---

## Task 8: `lib/public-config.ts` — which auth methods to render

**Files:**
- Create: `apps/mobile/src/lib/public-config.ts`
- Test: `apps/mobile/src/lib/public-config.test.ts`
- Reference (do not modify): `apps/web/src/components/auth/oauth-provider-selection.ts`

**Interfaces:**
- Consumes: the `Record<string, string>` payload of `GET /api/config/public`.
- Produces:
  ```typescript
  export const MOBILE_SOCIAL_PROVIDERS: readonly ["google", "apple"];
  export type MobileSocialProvider = "google" | "apple";

  export type PublicConfig = Record<string, string>;

  export type EnabledAuthMethods = {
    emailPassword: boolean;
    passwordReset: boolean;
    socialProviders: MobileSocialProvider[];
  };

  export function resolveEnabledProviders(config: PublicConfig): EnabledAuthMethods;
  ```
  Task 13's `(auth)/sign-in.tsx` and `(auth)/sign-up.tsx` consume this; `(auth)/forgot-password.tsx` is only reachable when `passwordReset` is true.

Semantics verified against the server, and they are not uniform — copy them exactly:

- Social providers use `<provider>_auth_enabled === "true"`. Absent means **disabled** (`packages/auth/src/server.ts`'s `isEnabled` is a strict `=== "true"` check). This matches `apps/web`'s `getEnabledOAuthProviders`, and matching it is the point: two clients reading the same endpoint must agree.
- Email/password uses `email_auth_enabled !== "false"`. Absent means **enabled** — that is how the server derives `password_reset_enabled` in `packages/api/src/routes/config.ts`, and `apps/web`'s sign-in form uses the same `!== "false"` test.
- `password_reset_enabled` is already derived server-side (it additionally requires a configured email channel), so it is a plain `=== "true"` read.

Known limitation to keep in the code comment: the server also requires OAuth client id/secret env vars to be present before it registers a provider, and `/api/config/public` does not expose whether the secret exists. A provider whose admin switch is on but whose env credentials are missing will still render a button that 404s. `apps/web` has exactly the same gap; fixing it belongs in the endpoint, not in one client.

GitHub is intentionally not in `MOBILE_SOCIAL_PROVIDERS`: v1's approved login methods are email/password + Google + Apple. Adding `"github"` to that tuple plus an icon in Task 13's button list is the whole change if it is wanted later.

- [ ] **Step 1: Read the web counterpart so the semantics stay aligned**

```bash
cat apps/web/src/components/auth/oauth-provider-selection.ts
grep -n "email_auth_enabled\|password_reset_enabled" apps/web/src/components/auth/sign-in-form.tsx
```

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/src/lib/public-config.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { resolveEnabledProviders } from "./public-config";

describe("resolveEnabledProviders", () => {
  it("treats an empty config as email-only with no social providers", () => {
    expect(resolveEnabledProviders({})).toEqual({
      emailPassword: true,
      passwordReset: false,
      socialProviders: [],
    });
  });

  it("disables email/password only on an explicit false", () => {
    expect(resolveEnabledProviders({ email_auth_enabled: "false" }).emailPassword).toBe(
      false
    );
    expect(resolveEnabledProviders({ email_auth_enabled: "true" }).emailPassword).toBe(
      true
    );
  });

  it("enables google when its switch is exactly \"true\"", () => {
    expect(
      resolveEnabledProviders({ google_auth_enabled: "true" }).socialProviders
    ).toEqual(["google"]);
  });

  it("does not enable google for any other value", () => {
    for (const value of ["false", "1", "TRUE", ""]) {
      expect(
        resolveEnabledProviders({ google_auth_enabled: value }).socialProviders
      ).toEqual([]);
    }
  });

  it("returns providers in a stable order regardless of config key order", () => {
    expect(
      resolveEnabledProviders({
        apple_auth_enabled: "true",
        google_auth_enabled: "true",
      }).socialProviders
    ).toEqual(["google", "apple"]);
  });

  it("ignores github even when the server reports it enabled", () => {
    expect(
      resolveEnabledProviders({ github_auth_enabled: "true" }).socialProviders
    ).toEqual([]);
  });

  it("reads password reset straight from the derived server flag", () => {
    expect(resolveEnabledProviders({ password_reset_enabled: "true" }).passwordReset).toBe(
      true
    );
    expect(
      resolveEnabledProviders({ password_reset_enabled: "false" }).passwordReset
    ).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm --filter mobile test -- public-config.test
```

Expected: FAIL with "Cannot find module './public-config'".

- [ ] **Step 4: Write the implementation**

Create `apps/mobile/src/lib/public-config.ts`:

```typescript
// apps/mobile/src/lib/public-config.ts —— 由 GET /api/config/public 决定登录页展示什么。
//
// 为什么不能硬编码按钮：packages/auth/src/server.ts 里 Google / GitHub / Apple 是
// **条件注册**的，开关关闭时对应端点根本不存在。硬编码的结果是用户点一下拿到 404
// （见 spec §6）。该端点本就是为登录页设计的（见 packages/api/src/routes/config.ts 注释）。
//
// 开关语义不统一，逐条对齐服务端，不要"顺手统一"：
//   - <provider>_auth_enabled：严格 === "true"，缺失即关闭（服务端 isEnabled 就是严格比较）；
//     与 apps/web 的 getEnabledOAuthProviders 保持一致 —— 两个客户端读同一端点必须给同一结论。
//   - email_auth_enabled：!== "false"，缺失即开启（服务端派生 password_reset_enabled 时就是这么判的）。
//   - password_reset_enabled：服务端已派生（还额外要求邮件渠道配置完成），直接读。
//
// 已知局限：服务端注册 provider 还要求 env 里的 client id/secret 齐备，而本端点
// 不下发 secret 是否存在。开关开着但凭据缺失时，按钮仍会渲染并 404。
// apps/web 有完全相同的局限；要修应该修端点，而不是在单个客户端打补丁。

// v1 支持的社交登录方式（spec §2 决策表：邮箱密码 + Google/Apple）。
// 要加 GitHub：把 "github" 加进这个元组，并在登录页补一个按钮即可。
export const MOBILE_SOCIAL_PROVIDERS = ["google", "apple"] as const;

export type MobileSocialProvider = (typeof MOBILE_SOCIAL_PROVIDERS)[number];

export type PublicConfig = Record<string, string>;

export type EnabledAuthMethods = {
  emailPassword: boolean;
  passwordReset: boolean;
  socialProviders: MobileSocialProvider[];
};

const SWITCH_KEYS: Record<MobileSocialProvider, string> = {
  apple: "apple_auth_enabled",
  google: "google_auth_enabled",
};

export function resolveEnabledProviders(
  config: PublicConfig
): EnabledAuthMethods {
  const socialProviders: MobileSocialProvider[] = [];
  for (const provider of MOBILE_SOCIAL_PROVIDERS) {
    if (config[SWITCH_KEYS[provider]] === "true") {
      socialProviders.push(provider);
    }
  }

  return {
    emailPassword: config.email_auth_enabled !== "false",
    passwordReset: config.password_reset_enabled === "true",
    socialProviders,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm --filter mobile test -- public-config.test
```

Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/public-config.ts apps/mobile/src/lib/public-config.test.ts
git commit -m "feat(mobile): derive enabled auth methods from public config"
```

---

## Task 9: i18n — new message keys plus `lib/locale.ts`

**Files:**
- Modify: `packages/i18n/messages/en.json`
- Modify: `packages/i18n/messages/zh.json`
- Create: `apps/mobile/src/lib/locale.ts`
- Test: `apps/mobile/src/lib/locale.test.ts`

**Interfaces:**
- Consumes: `SUPPORTED_LOCALES` and `DEFAULT_LOCALE` from `@openstarter/i18n` (runtime constants; that package has zero runtime dependencies, so importing it is safe on device).
- Produces:
  ```typescript
  export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale;
  export function resolveInitialLocale(
    deviceLocales: readonly string[],
    persisted: string | null
  ): SupportedLocale;
  ```
  Task 12's root layout calls `resolveInitialLocale` once at startup and hands the result to Paraglide's `setLocale`.

The existing catalog already covers most mobile copy. Reuse these rather than adding duplicates: `common.sign.sign_in_title`, `common.sign.sign_up_title`, `common.sign.email_title`, `common.sign.email_placeholder`, `common.sign.password_title`, `common.sign.password_placeholder`, `common.sign.name_title`, `common.sign.name_placeholder`, `common.sign.no_account`, `common.sign.already_have_account`, `common.sign.or`, `common.sign.sign_out_title`, `common.sign.google_sign_in`, `common.sign.forgot_password`, `common.sign.forgot_password_title`, `common.nav.profile`, `common.nav.settings`, `common.nav.theme_light`, `common.nav.theme_dark`, `common.nav.theme_system`, `common.error.title`, `common.error.retry`, `settings.profile.name`, `settings.profile.email`, `settings.profile.save`, `settings.profile.saving`, `settings.overview.plan`.

- [ ] **Step 1: Confirm which keys are genuinely missing**

```bash
python3 -c "
import json
en = json.load(open('packages/i18n/messages/en.json'))
need = ['common.sign.apple_sign_in','common.nav.home','common.nav.language','common.error.unreachable','common.error.misconfigured','mobile.home.greeting','mobile.settings.appearance','mobile.settings.version']
for k in need:
    print(('EXISTS ' if k in en else 'MISSING'), k)
"
```

Expected: all eight reported `MISSING`. If any already exists, reuse it and drop it from Step 2.

- [ ] **Step 2: Add the missing keys to both catalogs**

Add to `packages/i18n/messages/en.json`:

```json
  "common.sign.apple_sign_in": "Sign in with Apple",
  "common.nav.home": "Home",
  "common.nav.language": "Language",
  "common.error.unreachable": "Could not reach the server. Check your connection and try again.",
  "common.error.misconfigured": "The app is not configured correctly.",
  "mobile.home.greeting": "Signed in as",
  "mobile.settings.appearance": "Appearance",
  "mobile.settings.version": "Version",
```

Add to `packages/i18n/messages/zh.json`:

```json
  "common.sign.apple_sign_in": "使用 Apple 登录",
  "common.nav.home": "首页",
  "common.nav.language": "语言",
  "common.error.unreachable": "无法连接到服务器，请检查网络后重试。",
  "common.error.misconfigured": "应用配置有误。",
  "mobile.home.greeting": "当前登录账号",
  "mobile.settings.appearance": "外观",
  "mobile.settings.version": "版本",
```

Insert each key in a position consistent with the surrounding grouping (the `common.sign.*` keys together, `common.nav.*` together, and so on) — the files are flat key-value maps, so placement is cosmetic but keeps diffs readable.

- [ ] **Step 3: Verify key parity**

```bash
pnpm --filter @openstarter/i18n test
```

Expected: PASS. `packages/i18n/src/messages.property.test.ts` asserts the en and zh key sets are equal and that no value is empty — adding a key to only one file fails here.

- [ ] **Step 4: Write the failing locale test**

Create `apps/mobile/src/lib/locale.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { isSupportedLocale, resolveInitialLocale } from "./locale";

describe("isSupportedLocale", () => {
  it("accepts the supported locales", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("zh")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isSupportedLocale("fr")).toBe(false);
    expect(isSupportedLocale("zh-Hans")).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale("")).toBe(false);
  });
});

describe("resolveInitialLocale", () => {
  it("prefers the persisted choice over the device language", () => {
    expect(resolveInitialLocale(["en-US"], "zh")).toBe("zh");
  });

  it("ignores an unsupported persisted value and falls back to the device", () => {
    expect(resolveInitialLocale(["zh-Hans-CN"], "fr")).toBe("zh");
  });

  it("matches the device language by its primary subtag", () => {
    expect(resolveInitialLocale(["zh-Hans-CN"], null)).toBe("zh");
    expect(resolveInitialLocale(["en-GB"], null)).toBe("en");
  });

  it("scans past unsupported device locales to the first supported one", () => {
    expect(resolveInitialLocale(["fr-FR", "de-DE", "zh-CN"], null)).toBe("zh");
  });

  it("falls back to the default locale when nothing matches", () => {
    expect(resolveInitialLocale(["fr-FR"], null)).toBe("en");
  });

  it("falls back to the default locale for an empty device list", () => {
    expect(resolveInitialLocale([], null)).toBe("en");
  });

  it("is case-insensitive about the device tag", () => {
    expect(resolveInitialLocale(["ZH-CN"], null)).toBe("zh");
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
pnpm --filter mobile test -- locale.test
```

Expected: FAIL with "Cannot find module './locale'".

- [ ] **Step 6: Write the implementation**

Create `apps/mobile/src/lib/locale.ts`:

```typescript
// apps/mobile/src/lib/locale.ts —— 决定启动时用哪个语言。
//
// Web 端 Paraglide 走 url / cookie 策略，两者都是浏览器专属；原生端改为
// globalVariable + baseLocale，由应用自己解析并显式 setLocale（见 spec §6 国际化）。
//
// 优先级：用户显式选择（持久化） > 设备语言 > DEFAULT_LOCALE。
// 设备语言按主语言子标签匹配：zh-Hans-CN / ZH-CN 都应命中 "zh"。
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@openstarter/i18n";

export function isSupportedLocale(
  value: string | null | undefined
): value is SupportedLocale {
  if (!value) {
    return false;
  }
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function resolveInitialLocale(
  deviceLocales: readonly string[],
  persisted: string | null
): SupportedLocale {
  if (isSupportedLocale(persisted)) {
    return persisted;
  }

  for (const tag of deviceLocales) {
    const primary = tag.split("-")[0]?.toLowerCase();
    if (isSupportedLocale(primary)) {
      return primary;
    }
  }

  return DEFAULT_LOCALE;
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
pnpm --filter mobile test -- locale.test
```

Expected: PASS (10 tests)

- [ ] **Step 8: Confirm Paraglide compiles with the new keys and the native strategy**

```bash
pnpm --filter mobile paraglide:compile
ls apps/mobile/src/paraglide
```

Expected: the compile succeeds and `apps/mobile/src/paraglide/` contains a `runtime.js` and a `messages` output. Confirm the new keys made it in:

```bash
grep -rl "apple_sign_in" apps/mobile/src/paraglide | head -3
```

Expected: at least one match.

If `paraglide-js compile` rejects the `--strategy globalVariable baseLocale` flags, apply the spec §9 fallback: drop `baseLocale` and pass only `globalVariable`, letting `resolveInitialLocale` supply the fallback (it already returns `DEFAULT_LOCALE`, so behaviour is unchanged). Record which form was accepted in the commit body.

- [ ] **Step 9: Commit**

```bash
git add packages/i18n/messages/en.json packages/i18n/messages/zh.json apps/mobile/src/lib/locale.ts apps/mobile/src/lib/locale.test.ts
git commit -m "feat(mobile): add mobile message keys and locale resolution"
```

---

## Task 10: Real clients — auth, API, preferences, and query hooks

**Files:**
- Create: `apps/mobile/src/lib/auth-client.ts`
- Create: `apps/mobile/src/lib/api.ts`
- Create: `apps/mobile/src/lib/preferences.ts`
- Create: `apps/mobile/src/lib/queries.ts`

**Interfaces:**
- Consumes: `getEnv` (Task 5), `runRequest` (Task 6), `PublicConfig` (Task 8), `isSupportedLocale` (Task 9), `createAuthClient` from `@openstarter/auth/client/native` (Task 3).
- Produces:
  ```typescript
  // auth-client.ts
  export const authClient: ReturnType<typeof createAuthClient>;
  export function getSessionCookie(): string;

  // api.ts
  export const apiClient: ReturnType<typeof hc<AppType>>;

  // preferences.ts
  export type ThemePreference = "light" | "dark" | "system";
  export function loadThemePreference(): ThemePreference;
  export function saveThemePreference(value: ThemePreference): void;
  export function loadLocalePreference(): string | null;
  export function saveLocalePreference(value: string): void;

  // queries.ts
  export function usePublicConfig(): UseQueryResult<PublicConfig>;
  export function useUserPlan(): UseQueryResult<ApiResult<UserPlanView>>;
  export type UserPlanView = { plan: string; trialEndsAt: string | null };
  ```
  Tasks 12–14 consume all of these.

**No new unit tests.** Every one of these modules imports `expo-secure-store` (directly or transitively) or constructs a network client — both of which are outside a Node test environment. Their logic is already tested: `runRequest` in Task 6, `resolveApiUrl` in Task 5. What remains here is wiring, verified by `check-types` and by Task 15's manual checklist. This is the deliberate line the spec draws in §8.3.

- [ ] **Step 1: Write `lib/auth-client.ts`**

```typescript
// apps/mobile/src/lib/auth-client.ts —— Better Auth 原生客户端。
//
// 三处必须对齐、错一个就静默失效：
//   1. scheme "openstarter" —— 与 app.config.ts 的 scheme、服务端 trustedOrigins
//      的 "openstarter://" 同名，OAuth 深链才能回跳到应用；
//   2. cookiePrefix "openstarter" —— 与服务端 advanced.cookiePrefix 同值。Expo 插件
//      默认按 "better-auth" 前缀识别 cookie，不对齐会表现为反复重拉会话或登录后立刻掉线；
//   3. storage 用 expo-secure-store —— 其 getItem/setItem 是同步 API 且 getItem 返回
//      string | null，正好满足 ExpoClientOptions.storage 的契约，会话因此落在
//      iOS 钥匙串 / Android KeyStore，而不是普通存储。
//
// plugins 首版只注册 expoClient：邮箱密码与 OAuth 属 better-auth 核心能力，不需要插件。
// 其余插件位在 @openstarter/auth/client/native 已导出，后续启用只需往数组里加一项。
// Spec §4。
import {
  expoClient,
  setupExpoFocusManager,
  setupExpoOnlineManager,
} from "@better-auth/expo/client";
import { createAuthClient } from "@openstarter/auth/client/native";
import * as SecureStore from "expo-secure-store";

import { getEnv } from "./env";

const env = getEnv();

// 会话保鲜（spec §4）：这两个函数不是 createAuthClient 的选项，而是把 Expo 的
// AppState / 网络状态适配器装到 globalThis[kFocusManager] / globalThis[kOnlineManager]
// 的副作用调用（已核实 @better-auth/expo/dist/client.js）。better-auth 的会话刷新据此
// 在应用回到前台或网络恢复时重新校验会话。必须在 createAuthClient 之前调用。
// 两者都是幂等的（内部先判 globalThis 上是否已存在）。
setupExpoFocusManager();
setupExpoOnlineManager();

export const authClient = createAuthClient({
  // 配置非法时给一个占位 base URL：此时界面会停在配置错误屏（见 (auth)/(tabs) 门禁），
  // 不会真的发出请求，但 createAuthClient 需要一个可解析的字符串。
  baseURL: env.ok ? env.apiUrl : "http://127.0.0.1",
  plugins: [
    expoClient({
      cookiePrefix: "openstarter",
      scheme: "openstarter",
      storage: SecureStore,
    }),
  ],
});

/**
 * 取出设备上存储的会话 cookie，供非 auth 的 API 请求携带。
 *
 * `getCookie()` 由 expoClient 提供，其官方注释即说明用途是"取出 cookie 并放进你自己的
 * fetch 请求头"。lib/api.ts 依此接线。
 */
export function getSessionCookie(): string {
  return authClient.getCookie();
}
```

- [ ] **Step 2: Write `lib/api.ts`**

```typescript
// apps/mobile/src/lib/api.ts —— 类型化 Hono RPC 客户端。
//
// 与 apps/web 的 `hc<AppType>("/")` 完全对称，差异只有两点：
//   - 绝对 base URL（移动端不在 Web 同源下，没有相对路径可用）；
//   - 显式 cookie 头（原生端没有浏览器自动带 cookie 的行为）。
//
// AppType 是 **type-only** 导入：@openstarter/api 在 devDependencies 里，
// 该导入在编译期被擦除，Metro 不会看到服务端依赖图（tsconfig 的
// verbatimModuleSyntax 会在编译期挡住误写成值导入的情况）。见 spec §3.2 / §5.2。
import type { AppType } from "@openstarter/api";
import { hc } from "hono/client";

import { getSessionCookie } from "./auth-client";
import { getEnv } from "./env";

const env = getEnv();

export const apiClient = hc<AppType>(env.ok ? env.apiUrl : "http://127.0.0.1", {
  headers: () => ({ cookie: getSessionCookie() }),
});
```

- [ ] **Step 3: Write `lib/preferences.ts`**

```typescript
// apps/mobile/src/lib/preferences.ts —— 主题与语言选择的持久化。
//
// 复用 expo-secure-store 而不是引入 AsyncStorage：这两个标量本身不是机密，
// 但 SecureStore 已经是依赖（会话存储需要它），为两个标量再加一个存储库不值得；
// 且它的 getItem 是同步的，启动时能在首帧之前读到，避免闪一下错误的主题/语言。
import * as SecureStore from "expo-secure-store";

import { isSupportedLocale } from "./locale";

const THEME_KEY = "openstarter_theme";
const LOCALE_KEY = "openstarter_locale";

export type ThemePreference = "light" | "dark" | "system";

const THEME_VALUES: readonly ThemePreference[] = ["light", "dark", "system"];

function isThemePreference(value: string | null): value is ThemePreference {
  return value !== null && (THEME_VALUES as readonly string[]).includes(value);
}

export function loadThemePreference(): ThemePreference {
  const stored = SecureStore.getItem(THEME_KEY);
  return isThemePreference(stored) ? stored : "system";
}

export function saveThemePreference(value: ThemePreference): void {
  SecureStore.setItem(THEME_KEY, value);
}

export function loadLocalePreference(): string | null {
  const stored = SecureStore.getItem(LOCALE_KEY);
  return isSupportedLocale(stored) ? stored : null;
}

export function saveLocalePreference(value: string): void {
  SecureStore.setItem(LOCALE_KEY, value);
}
```

- [ ] **Step 4: Write `lib/queries.ts`**

```typescript
// apps/mobile/src/lib/queries.ts —— 经类型化客户端拉数据的 TanStack Query 钩子。
//
// 会话状态刻意不进 Query：它走 authClient.useSession() 自己的 store，
// 两套缓存并存只会互相打架（见 spec §5.4）。
//
// 每个查询都返回 ApiResult 而不是抛异常：401 是"未登录"而不是错误，
// 交给界面按 status 分流（见 spec §7）。因此 queryFn 永不 reject，
// retry 也就没有意义 —— 重试由界面上的显式按钮驱动。
import { useQuery } from "@tanstack/react-query";

import type { ApiResult } from "./api-error";
import { runRequest } from "./api-error";
import { apiClient } from "./api";
import type { PublicConfig } from "./public-config";

const PUBLIC_CONFIG_STALE_MS = 5 * 60 * 1000;

export type UserPlanView = {
  plan: string;
  trialEndsAt: string | null;
};

export function usePublicConfig() {
  return useQuery({
    queryFn: async (): Promise<PublicConfig> => {
      const result = await runRequest(
        () => apiClient.api.config.public.$get(),
        (body) => (body as { data?: PublicConfig }).data ?? {}
      );
      // 公开配置拿不到时退回空对象：resolveEnabledProviders({}) 的结果是
      // "只有邮箱密码"，这是最保守也最不会 404 的降级（见 spec §6）。
      return result.status === "success" ? result.data : {};
    },
    queryKey: ["public-config"],
    staleTime: PUBLIC_CONFIG_STALE_MS,
  });
}

export function useUserPlan() {
  return useQuery({
    queryFn: (): Promise<ApiResult<UserPlanView>> =>
      runRequest(
        () => apiClient.api.user.plan.$get(),
        (body) => {
          const data = (body as { data: { plan: string; trialEndsAt?: string } })
            .data;
          return { plan: data.plan, trialEndsAt: data.trialEndsAt ?? null };
        }
      ),
    queryKey: ["user-plan"],
    retry: false,
  });
}
```

`trialEndsAt` is typed as `string | null` rather than `Date`: the server returns a `Date` from `getUserPlan`, but it crosses the wire as JSON, so the client only ever sees an ISO string.

- [ ] **Step 5: Type-check**

```bash
pnpm --filter mobile check-types
```

Expected: PASS.

If `apiClient.api.config.public.$get()` or `apiClient.api.user.plan.$get()` fails to type-check, compare the call shape against `apps/web/src/lib/use-public-config.ts` (which calls `client.api.config.public.$get()` against the same `AppType`) and adjust — Hono's RPC typing is strict about matching each route's validators.

If `expoClient({ storage: SecureStore })` fails to type-check, it means the installed `expo-secure-store` exposes only the async API in this SDK. In that case pass an explicit adapter instead, keeping the synchronous contract `ExpoClientOptions.storage` requires:

```typescript
    expoClient({
      cookiePrefix: "openstarter",
      scheme: "openstarter",
      storage: {
        getItem: (key) => SecureStore.getItem(key),
        setItem: (key, value) => SecureStore.setItem(key, value),
      },
    }),
```

- [ ] **Step 6: Lint**

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/lib/auth-client.ts apps/mobile/src/lib/api.ts apps/mobile/src/lib/preferences.ts apps/mobile/src/lib/queries.ts
git commit -m "feat(mobile): wire auth client, typed API client, and query hooks"
```

---

## Task 11: Theme hook and the minimal UI component set

**Files:**
- Create: `apps/mobile/src/lib/theme.ts`
- Create: `apps/mobile/src/lib/i18n.ts`
- Create: `apps/mobile/src/components/ui/screen.tsx`
- Create: `apps/mobile/src/components/ui/spinner.tsx`
- Create: `apps/mobile/src/components/ui/button.tsx`
- Create: `apps/mobile/src/components/ui/input.tsx`
- Create: `apps/mobile/src/components/ui/card.tsx`
- Create: `apps/mobile/src/components/ui/badge.tsx`

**Interfaces:**
- Consumes: `loadThemePreference` / `saveThemePreference` / `loadLocalePreference` / `saveLocalePreference` (Task 10), `resolveInitialLocale` (Task 9), the token class names from Task 4's `tailwind.config.js`.
- Produces:
  ```typescript
  // lib/theme.ts
  export function useThemePreference(): {
    preference: ThemePreference;
    setPreference: (next: ThemePreference) => void;
  };

  // lib/i18n.ts
  export function useAppLocale(): {
    locale: SupportedLocale;
    setAppLocale: (next: SupportedLocale) => void;
  };

  // components/ui
  export function Screen(props: { children: ReactNode; className?: string }): ReactNode;
  export function Spinner(): ReactNode;
  export function Button(props: {
    label: string;
    onPress: () => void;
    variant?: "primary" | "outline" | "ghost";
    disabled?: boolean;
    loading?: boolean;
    accessibilityLabel?: string;
  }): ReactNode;
  export function Input(props: {
    label: string;
    value: string;
    onChangeText: (next: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    secureTextEntry?: boolean;
    autoComplete?: "email" | "password" | "name" | "off";
    errors?: string[];
  }): ReactNode;
  export function Card(props: { title?: string; children: ReactNode }): ReactNode;
  export function Badge(props: { label: string }): ReactNode;
  ```
  Tasks 12–14 consume all of them.

Class-name convention, following Task 4's token shape: light tokens are the base and dark ones are addressed through the nested key — `bg-background dark:bg-dark-background`, `text-foreground dark:text-dark-foreground`.

Accessibility rules for this task (spec §6): every `Pressable` sets `accessibilityRole="button"`; icon-only or ambiguous controls set an explicit `accessibilityLabel`; touch targets are at least 44×44 (`min-h-[44px]`).

**No unit tests here** — these are presentational wrappers with no branching logic worth asserting, and the spec rules out RN component rendering tests (§8.3). They are verified by `check-types` and Task 15's manual pass.

- [ ] **Step 1: Install the icon set used by the tab bar**

```bash
pnpm --filter mobile exec npx expo install @expo/vector-icons
```

- [ ] **Step 2: Create `apps/mobile/src/lib/theme.ts`**

```typescript
// apps/mobile/src/lib/theme.ts —— 主题偏好（浅色/深色/跟随系统）。
// 不复用 next-themes：那是 Web 专属的。NativeWind 的 setColorScheme 接受
// "light" | "dark" | "system"，与我们持久化的三个值一一对应。
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";

import type { ThemePreference } from "./preferences";
import { loadThemePreference, saveThemePreference } from "./preferences";

export function useThemePreference() {
  const { setColorScheme } = useColorScheme();
  const [preference, setStoredPreference] = useState<ThemePreference>(() =>
    loadThemePreference()
  );

  useEffect(() => {
    setColorScheme(preference);
  }, [preference, setColorScheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    saveThemePreference(next);
    setStoredPreference(next);
  }, []);

  return { preference, setPreference };
}
```

- [ ] **Step 3: Create `apps/mobile/src/lib/i18n.ts`**

```typescript
// apps/mobile/src/lib/i18n.ts —— 启动时确定语言，并暴露切换入口。
//
// 初始化刻意放在模块作用域：它只应发生一次，且必须在任何组件读取消息之前完成。
// 放进 useState 初始化器会变成"渲染期副作用"，放进 useEffect 又会让首帧用错语言。
//
// setLocale 传 reload: false —— Paraglide 在 Web 上默认重载页面，原生端没有重载概念，
// 改由 React state 驱动重渲染（见 spec §6 国际化）。
import type { SupportedLocale } from "@openstarter/i18n";
import { getLocales } from "expo-localization";
import { useCallback, useState } from "react";

import { setLocale } from "@/paraglide/runtime.js";

import { resolveInitialLocale } from "./locale";
import { loadLocalePreference, saveLocalePreference } from "./preferences";

const initialLocale = resolveInitialLocale(
  getLocales().map((entry) => entry.languageTag),
  loadLocalePreference()
);

setLocale(initialLocale, { reload: false });

export function useAppLocale() {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);

  const setAppLocale = useCallback((next: SupportedLocale) => {
    saveLocalePreference(next);
    setLocale(next, { reload: false });
    setLocaleState(next);
  }, []);

  return { locale, setAppLocale };
}
```

After writing this, confirm the generated runtime actually exports `setLocale` with an options argument:

```bash
grep -n "export const setLocale\|export function setLocale" apps/mobile/src/paraglide/runtime.js
```

If `setLocale` does not accept an options object in the installed Paraglide version, drop the second argument — the reload behaviour it guards against is web-only anyway, so calling `setLocale(next)` on native is equivalent. Record which form was used.

- [ ] **Step 4: Create `apps/mobile/src/components/ui/screen.tsx`**

```tsx
import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen(props: { children: ReactNode; className?: string }) {
  return (
    <SafeAreaView
      className={`flex-1 bg-background dark:bg-dark-background ${props.className ?? ""}`}
    >
      {props.children}
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: Create `apps/mobile/src/components/ui/spinner.tsx`**

```tsx
import { ActivityIndicator, View } from "react-native";

export function Spinner() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-dark-background">
      <ActivityIndicator />
    </View>
  );
}
```

- [ ] **Step 6: Create `apps/mobile/src/components/ui/button.tsx`**

```tsx
import { ActivityIndicator, Pressable, Text } from "react-native";

type ButtonVariant = "primary" | "outline" | "ghost";

const CONTAINER_CLASS: Record<ButtonVariant, string> = {
  ghost: "",
  outline: "border border-border dark:border-dark-border",
  primary: "bg-primary dark:bg-dark-primary",
};

const LABEL_CLASS: Record<ButtonVariant, string> = {
  ghost: "text-foreground dark:text-dark-foreground",
  outline: "text-foreground dark:text-dark-foreground",
  primary: "text-primary-foreground dark:text-dark-primary-foreground",
};

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const variant = props.variant ?? "primary";
  const isBlocked = Boolean(props.disabled) || Boolean(props.loading);

  return (
    <Pressable
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(props.loading), disabled: isBlocked }}
      className={`min-h-[44px] items-center justify-center rounded-xl px-4 ${CONTAINER_CLASS[variant]} ${isBlocked ? "opacity-50" : ""}`}
      disabled={isBlocked}
      onPress={props.onPress}
    >
      {props.loading ? (
        <ActivityIndicator />
      ) : (
        <Text className={`font-medium text-base ${LABEL_CLASS[variant]}`}>
          {props.label}
        </Text>
      )}
    </Pressable>
  );
}
```

- [ ] **Step 7: Create `apps/mobile/src/components/ui/input.tsx`**

```tsx
import { Text, TextInput, View } from "react-native";

export function Input(props: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoComplete?: "email" | "password" | "name" | "off";
  errors?: string[];
}) {
  const errors = props.errors ?? [];

  return (
    <View className="gap-1.5">
      <Text className="font-medium text-foreground text-sm dark:text-dark-foreground">
        {props.label}
      </Text>
      <TextInput
        accessibilityLabel={props.label}
        autoCapitalize="none"
        autoComplete={props.autoComplete ?? "off"}
        className="min-h-[44px] rounded-xl border border-border px-3 text-base text-foreground dark:border-dark-border dark:text-dark-foreground"
        onBlur={props.onBlur}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        secureTextEntry={Boolean(props.secureTextEntry)}
        value={props.value}
      />
      {errors.map((message) => (
        <Text
          className="text-destructive text-xs dark:text-dark-destructive"
          key={message}
        >
          {message}
        </Text>
      ))}
    </View>
  );
}
```

- [ ] **Step 8: Create `apps/mobile/src/components/ui/card.tsx`**

```tsx
import type { ReactNode } from "react";
import { Text, View } from "react-native";

export function Card(props: { title?: string; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4 dark:border-dark-border dark:bg-dark-card">
      {props.title ? (
        <Text className="font-semibold text-base text-card-foreground dark:text-dark-card-foreground">
          {props.title}
        </Text>
      ) : null}
      {props.children}
    </View>
  );
}
```

- [ ] **Step 9: Create `apps/mobile/src/components/ui/badge.tsx`**

```tsx
import { Text, View } from "react-native";

export function Badge(props: { label: string }) {
  return (
    <View className="self-start rounded-full bg-secondary px-2.5 py-1 dark:bg-dark-secondary">
      <Text className="font-medium text-secondary-foreground text-xs dark:text-dark-secondary-foreground">
        {props.label}
      </Text>
    </View>
  );
}
```

- [ ] **Step 10: Type-check and lint**

```bash
pnpm --filter mobile check-types
pnpm lint
```

Expected: both PASS. If `className` is rejected on `View`/`Text`/`Pressable`, `nativewind-env.d.ts` (Task 4 Step 6) is missing from the tsconfig `include` array.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/src/lib/theme.ts apps/mobile/src/lib/i18n.ts apps/mobile/src/components
git commit -m "feat(mobile): add theme hook, locale hook, and base UI components"
```

---

## Task 12: Root layout, providers, and the two route-group gates

**Files:**
- Create: `apps/mobile/src/components/config-error.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx` (replace Task 4's temporary shell)
- Create: `apps/mobile/src/app/(auth)/_layout.tsx`
- Create: `apps/mobile/src/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/src/app/(tabs)/index.tsx` (placeholder body; filled in Task 14)
- Delete: `apps/mobile/src/app/index.tsx` (Task 4's placeholder)

**Interfaces:**
- Consumes: `getEnv` (Task 5), `deriveAuthGate` (Task 7), `authClient` (Task 10), `useThemePreference` / `useAppLocale` (Task 11), `Screen` / `Spinner` (Task 11).
- Produces: the navigation shell. `(auth)` routes resolve to `/sign-in`, `/sign-up`, `/forgot-password`; `(tabs)/index.tsx` owns `/`. Tasks 13 and 14 only add screens inside these groups.

`src/app/index.tsx` must be deleted in this task: `(tabs)/index.tsx` also maps to `/`, and two route files cannot own the same path.

The configuration-error screen is checked in the root layout, before either gate. Without it, a bad `EXPO_PUBLIC_API_URL` surfaces as a session request that never succeeds — i.e. an endless spinner or a sign-in screen that rejects correct credentials (spec §7 rule 4).

- [ ] **Step 1: Create `apps/mobile/src/components/config-error.tsx`**

```tsx
import { Text, View } from "react-native";

import { m } from "@/paraglide/messages.js";

import { Screen } from "./ui/screen";

export function ConfigError(props: { reason: string }) {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-2 p-6">
        <Text className="font-semibold text-destructive text-base dark:text-dark-destructive">
          {m["common.error.misconfigured"]()}
        </Text>
        <Text className="text-center text-muted-foreground text-sm dark:text-dark-muted-foreground">
          {props.reason}
        </Text>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Replace `apps/mobile/src/app/_layout.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../../global.css";

import { ConfigError } from "@/components/config-error";
import { getEnv } from "@/lib/env";
import { useAppLocale } from "@/lib/i18n";
import { useThemePreference } from "@/lib/theme";

export default function RootLayout() {
  // QueryClient 必须在渲染之间保持同一实例，否则每次重渲染都会丢掉全部缓存。
  const [queryClient] = useState(() => new QueryClient());
  const env = getEnv();

  // 两个钩子必须无条件调用（React hooks 规则），因此放在 env 分支之前。
  useThemePreference();
  useAppLocale();

  if (!env.ok) {
    return (
      <SafeAreaProvider>
        <ConfigError reason={env.reason} />
      </SafeAreaProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Delete the placeholder route**

```bash
rm apps/mobile/src/app/index.tsx
```

- [ ] **Step 4: Create `apps/mobile/src/app/(auth)/_layout.tsx`**

```tsx
import { Redirect, Stack } from "expo-router";

import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { deriveAuthGate } from "@/lib/auth-gate";

export default function AuthLayout() {
  const { data: session, isPending } = authClient.useSession();
  const gate = deriveAuthGate({ isPending, session });

  if (gate === "loading") {
    return <Spinner />;
  }

  // 已登录的人不该看到登录页。"/" 由 (tabs)/index.tsx 承载，
  // 这里用路径而不是分组名，避免和路由组的内部命名耦合。
  if (gate === "authenticated") {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 5: Create `apps/mobile/src/app/(tabs)/_layout.tsx`**

```tsx
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { deriveAuthGate } from "@/lib/auth-gate";
import { m } from "@/paraglide/messages.js";

export default function TabsLayout() {
  const { data: session, isPending } = authClient.useSession();
  const gate = deriveAuthGate({ isPending, session });

  if (gate === "loading") {
    return <Spinner />;
  }

  if (gate === "unauthenticated") {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="home-outline" size={size} />
          ),
          title: m["common.nav.home"](),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="person-outline" size={size} />
          ),
          title: m["common.nav.profile"](),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="settings-outline" size={size} />
          ),
          title: m["common.nav.settings"](),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 6: Create a temporary `apps/mobile/src/app/(tabs)/index.tsx`**

Task 14 replaces this body. It exists now so `(tabs)` has a resolvable initial route and the gate can be exercised.

```tsx
import { Text, View } from "react-native";

import { Screen } from "@/components/ui/screen";

export default function HomeScreen() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center">
        <Text className="text-foreground dark:text-dark-foreground">Home</Text>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 7: Type-check**

```bash
pnpm --filter mobile check-types
```

Expected: FAIL at this point — `(tabs)/_layout.tsx` references `profile` and `settings` screens that do not exist yet, and `(auth)` has no `sign-in` route for `<Redirect href="/sign-in" />`. That is expected and is resolved by Tasks 13 and 14.

To keep this task independently verifiable, create the three missing files as one-line stubs now and let Tasks 13/14 fill them:

`apps/mobile/src/app/(tabs)/profile.tsx`, `apps/mobile/src/app/(tabs)/settings.tsx`, `apps/mobile/src/app/(auth)/sign-in.tsx`, `apps/mobile/src/app/(auth)/sign-up.tsx`, `apps/mobile/src/app/(auth)/forgot-password.tsx` — each with this body, substituting the component name (`ProfileScreen`, `SettingsScreen`, `SignInScreen`, `SignUpScreen`, `ForgotPasswordScreen`):

```tsx
import { Text } from "react-native";

import { Screen } from "@/components/ui/screen";

export default function ProfileScreen() {
  return (
    <Screen>
      <Text className="text-foreground dark:text-dark-foreground">Profile</Text>
    </Screen>
  );
}
```

Re-run:

```bash
pnpm --filter mobile check-types
```

Expected: PASS.

- [ ] **Step 8: Confirm the gate works on a device or simulator**

Start `pnpm dev:mobile` as a background process, open the app, and confirm: with no session, the app lands on the sign-in stub (not the tab bar). Stop the process afterwards. Full auth flows are verified in Task 15.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/app apps/mobile/src/components/config-error.tsx
git commit -m "feat(mobile): add providers, config error screen, and route group gates"
```

---

## Task 13: `(auth)` screens — sign in, sign up, forgot password

**Files:**
- Create: `apps/mobile/src/components/auth/social-buttons.tsx`
- Modify: `apps/mobile/src/app/(auth)/sign-in.tsx`
- Modify: `apps/mobile/src/app/(auth)/sign-up.tsx`
- Modify: `apps/mobile/src/app/(auth)/forgot-password.tsx`

**Interfaces:**
- Consumes: `resolveEnabledProviders` / `MobileSocialProvider` (Task 8), `usePublicConfig` (Task 10), `authClient` (Task 10), the UI components (Task 11).
- Produces: nothing downstream — these are leaves.

Better Auth client calls, taken from the shapes `apps/web` already uses against the same server: `authClient.signIn.email({ email, password })`, `authClient.signUp.email({ email, name, password })`, `authClient.signIn.social({ callbackURL, provider })`, `authClient.requestPasswordReset({ email, redirectTo })`. Each returns a result object carrying `error`, rather than throwing.

No manual navigation after a successful sign-in: the session updates, `(auth)/_layout.tsx`'s gate re-evaluates, and its `<Redirect href="/" />` moves the user. Calling `router.replace` as well would race the gate.

Form handling mirrors `apps/web/src/components/auth/sign-in-form.tsx`: `useForm({ defaultValues, onSubmit, validators: { onSubmit: z.object(...) } })`, `<form.Field name="...">{(field) => ...}</form.Field>` reading `field.state.value` / `field.handleChange` / `field.state.meta.errors`, and `<form.Subscribe selector={...}>` for the submit button state. Read that file before writing these, so the field API stays identical.

- [ ] **Step 1: Create `apps/mobile/src/components/auth/social-buttons.tsx`**

```tsx
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { MobileSocialProvider } from "@/lib/public-config";
import { m } from "@/paraglide/messages.js";

const LABELS: Record<MobileSocialProvider, () => string> = {
  apple: () => m["common.sign.apple_sign_in"](),
  google: () => m["common.sign.google_sign_in"](),
};

export function SocialButtons(props: {
  providers: MobileSocialProvider[];
  onError: (message: string) => void;
}) {
  const handlePress = (provider: MobileSocialProvider) => {
    // callbackURL 是应用内路径；Expo 插件据 scheme 组装成深链，
    // 授权完成后浏览器回跳到 openstarter:// 并由 expo-router 落到这里。
    authClient.signIn
      .social({ callbackURL: "/", provider })
      .catch((error: unknown) => {
        props.onError(
          error instanceof Error ? error.message : "OAuth sign-in failed"
        );
      });
  };

  return (
    <View className="gap-2">
      {props.providers.map((provider) => (
        <Button
          key={provider}
          label={LABELS[provider]()}
          onPress={() => handlePress(provider)}
          variant="outline"
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Write `apps/mobile/src/app/(auth)/sign-in.tsx`**

```tsx
import { useForm } from "@tanstack/react-form";
import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import * as z from "zod";

import { SocialButtons } from "@/components/auth/social-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { resolveEnabledProviders } from "@/lib/public-config";
import { usePublicConfig } from "@/lib/queries";
import { m } from "@/paraglide/messages.js";

const MIN_PASSWORD_LENGTH = 8;

export default function SignInScreen() {
  const [error, setError] = useState("");
  const configQuery = usePublicConfig();
  const methods = resolveEnabledProviders(configQuery.data ?? {});

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setError("");
      const result = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      });
      if (result.error) {
        setError(result.error.message ?? "Sign in failed");
      }
      // 成功后不手动跳转：(auth)/_layout.tsx 的门禁会因会话变化把人带到 "/"。
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        password: z
          .string()
          .min(MIN_PASSWORD_LENGTH, "Password must be at least 8 characters"),
      }),
    },
  });

  return (
    <Screen>
      <View className="flex-1 justify-center gap-5 p-6">
        <Text className="text-center font-bold text-2xl text-foreground dark:text-dark-foreground">
          {m["common.sign.sign_in_title"]()}
        </Text>

        {methods.socialProviders.length > 0 ? (
          <SocialButtons onError={setError} providers={methods.socialProviders} />
        ) : null}

        {methods.socialProviders.length > 0 && methods.emailPassword ? (
          <Text className="text-center text-muted-foreground text-xs dark:text-dark-muted-foreground">
            {m["common.sign.or"]()}
          </Text>
        ) : null}

        {methods.emailPassword ? (
          <View className="gap-4">
            <form.Field name="email">
              {(field) => (
                <Input
                  autoComplete="email"
                  errors={field.state.meta.errors.map(
                    (item) => item?.message ?? ""
                  )}
                  label={m["common.sign.email_title"]()}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  placeholder={m["common.sign.email_placeholder"]()}
                  value={field.state.value}
                />
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <Input
                  autoComplete="password"
                  errors={field.state.meta.errors.map(
                    (item) => item?.message ?? ""
                  )}
                  label={m["common.sign.password_title"]()}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  placeholder={m["common.sign.password_placeholder"]()}
                  secureTextEntry
                  value={field.state.value}
                />
              )}
            </form.Field>

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  disabled={!canSubmit}
                  label={m["common.sign.sign_in_title"]()}
                  loading={isSubmitting}
                  onPress={() => {
                    form.handleSubmit();
                  }}
                />
              )}
            </form.Subscribe>
          </View>
        ) : null}

        {error.length > 0 ? (
          <Text className="text-center text-destructive text-sm dark:text-dark-destructive">
            {error}
          </Text>
        ) : null}

        {methods.passwordReset ? (
          <Link asChild href="/forgot-password">
            <Text className="text-center text-muted-foreground text-sm underline dark:text-dark-muted-foreground">
              {m["common.sign.forgot_password"]()}
            </Text>
          </Link>
        ) : null}

        <Link asChild href="/sign-up">
          <Text className="text-center text-foreground text-sm dark:text-dark-foreground">
            {m["common.sign.no_account"]()}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 3: Write `apps/mobile/src/app/(auth)/sign-up.tsx`**

```tsx
import { useForm } from "@tanstack/react-form";
import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";

const MIN_PASSWORD_LENGTH = 8;
const MIN_NAME_LENGTH = 2;

export default function SignUpScreen() {
  const [error, setError] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);

  const form = useForm({
    defaultValues: { email: "", name: "", password: "" },
    onSubmit: async ({ value }) => {
      setError("");
      const result = await authClient.signUp.email({
        email: value.email,
        name: value.name,
        password: value.password,
      });
      if (result.error) {
        setError(result.error.message ?? "Sign up failed");
        return;
      }
      // 服务端可能要求邮箱验证（REQUIRE_EMAIL_VERIFICATION）。此时不会立即产生会话，
      // 门禁也就不会跳转，因此给出明确提示而不是让人盯着不动的界面。
      setPendingVerification(true);
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        name: z.string().min(MIN_NAME_LENGTH, "Name is too short"),
        password: z
          .string()
          .min(MIN_PASSWORD_LENGTH, "Password must be at least 8 characters"),
      }),
    },
  });

  return (
    <Screen>
      <View className="flex-1 justify-center gap-5 p-6">
        <Text className="text-center font-bold text-2xl text-foreground dark:text-dark-foreground">
          {m["common.sign.sign_up_title"]()}
        </Text>

        <View className="gap-4">
          <form.Field name="name">
            {(field) => (
              <Input
                autoComplete="name"
                errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                label={m["common.sign.name_title"]()}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                placeholder={m["common.sign.name_placeholder"]()}
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Field name="email">
            {(field) => (
              <Input
                autoComplete="email"
                errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                label={m["common.sign.email_title"]()}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                placeholder={m["common.sign.email_placeholder"]()}
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <Input
                autoComplete="password"
                errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                label={m["common.sign.password_title"]()}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                placeholder={m["common.sign.password_placeholder"]()}
                secureTextEntry
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                disabled={!canSubmit}
                label={m["common.sign.sign_up_title"]()}
                loading={isSubmitting}
                onPress={() => {
                  form.handleSubmit();
                }}
              />
            )}
          </form.Subscribe>
        </View>

        {pendingVerification ? (
          <Text className="text-center text-muted-foreground text-sm dark:text-dark-muted-foreground">
            {m["common.sign.sign_up_description"]()}
          </Text>
        ) : null}

        {error.length > 0 ? (
          <Text className="text-center text-destructive text-sm dark:text-dark-destructive">
            {error}
          </Text>
        ) : null}

        <Link asChild href="/sign-in">
          <Text className="text-center text-foreground text-sm dark:text-dark-foreground">
            {m["common.sign.already_have_account"]()}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 4: Write `apps/mobile/src/app/(auth)/forgot-password.tsx`**

```tsx
import { useForm } from "@tanstack/react-form";
import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { getEnv } from "@/lib/env";
import { m } from "@/paraglide/messages.js";

export default function ForgotPasswordScreen() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const env = getEnv();

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setError("");
      // 重置链接必须落在 Web 端（原生端不实现重置表单），
      // 因此 redirectTo 指向 API 同源的 /reset-password —— 与 apps/web 的行为一致。
      const result = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: env.ok ? `${env.apiUrl}/reset-password` : undefined,
      });
      if (result.error) {
        setError(result.error.message ?? "Request failed");
        return;
      }
      // 账户枚举防护：无论邮箱是否存在都展示同一结果。
      setSent(true);
    },
    validators: {
      onSubmit: z.object({ email: z.email("Invalid email address") }),
    },
  });

  return (
    <Screen>
      <View className="flex-1 justify-center gap-5 p-6">
        <Text className="text-center font-bold text-2xl text-foreground dark:text-dark-foreground">
          {m["common.sign.forgot_password_title"]()}
        </Text>

        {sent ? (
          <Text className="text-center text-muted-foreground text-sm dark:text-dark-muted-foreground">
            {m["common.sign.forgot_password"]()}
          </Text>
        ) : (
          <View className="gap-4">
            <form.Field name="email">
              {(field) => (
                <Input
                  autoComplete="email"
                  errors={field.state.meta.errors.map(
                    (item) => item?.message ?? ""
                  )}
                  label={m["common.sign.email_title"]()}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  placeholder={m["common.sign.email_placeholder"]()}
                  value={field.state.value}
                />
              )}
            </form.Field>

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  disabled={!canSubmit}
                  label={m["common.sign.forgot_password_title"]()}
                  loading={isSubmitting}
                  onPress={() => {
                    form.handleSubmit();
                  }}
                />
              )}
            </form.Subscribe>
          </View>
        )}

        {error.length > 0 ? (
          <Text className="text-center text-destructive text-sm dark:text-dark-destructive">
            {error}
          </Text>
        ) : null}

        <Link asChild href="/sign-in">
          <Text className="text-center text-foreground text-sm dark:text-dark-foreground">
            {m["common.sign.sign_in_title"]()}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 5: Type-check and lint**

```bash
pnpm --filter mobile check-types
pnpm lint
```

Expected: both PASS.

If `field.state.meta.errors.map((item) => item?.message ?? "")` fails to type-check, inspect the actual error element type in `apps/web/src/components/auth/sign-in-form.tsx` (it renders `error?.message` directly) and adjust the mapping to match — TanStack Form's error element type depends on the validator adapter.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/app/\(auth\) apps/mobile/src/components/auth
git commit -m "feat(mobile): add sign-in, sign-up, and forgot-password screens"
```

---

## Task 14: `(tabs)` screens — home, profile, settings

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/index.tsx`
- Modify: `apps/mobile/src/app/(tabs)/profile.tsx`
- Modify: `apps/mobile/src/app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: `useUserPlan` (Task 10), `authClient` (Task 10), `useThemePreference` / `useAppLocale` (Task 11), UI components (Task 11), `ApiResult` (Task 6).
- Produces: nothing downstream — these are leaves.

The home screen is the typed-call sample: current user plus `GET /api/user/plan`. It must render all four `ApiResult` branches, and `"unauthorized"` must sign the user out rather than show an error (spec §7 rule 2) — after `signOut()`, the session clears and `(tabs)/_layout.tsx`'s gate redirects to `/sign-in`.

Sign-out appears only on the settings screen, not on both profile and settings.

- [ ] **Step 1: Write `apps/mobile/src/app/(tabs)/index.tsx`**

```tsx
import { useEffect } from "react";
import { Text, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { useUserPlan } from "@/lib/queries";
import { m } from "@/paraglide/messages.js";

export default function HomeScreen() {
  const { data: session } = authClient.useSession();
  const planQuery = useUserPlan();
  const result = planQuery.data;

  // 401 = 未登录，而不是错误：清掉会话，门禁随即把人送回登录页（spec §7 第 2 条）。
  useEffect(() => {
    if (result?.status === "unauthorized") {
      authClient.signOut().catch(() => undefined);
    }
  }, [result?.status]);

  if (planQuery.isPending || !result) {
    return <Spinner />;
  }

  return (
    <Screen>
      <View className="gap-4 p-6">
        <View className="gap-1">
          <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
            {m["mobile.home.greeting"]()}
          </Text>
          <Text className="font-semibold text-foreground text-lg dark:text-dark-foreground">
            {session?.user.email ?? ""}
          </Text>
        </View>

        <Card title={m["settings.overview.plan"]()}>
          {result.status === "success" ? <Badge label={result.data.plan} /> : null}

          {result.status === "unreachable" ? (
            <View className="gap-3">
              <Text className="text-destructive text-sm dark:text-dark-destructive">
                {m["common.error.unreachable"]()}
              </Text>
              <Button
                label={m["common.error.retry"]()}
                onPress={() => {
                  planQuery.refetch().catch(() => undefined);
                }}
                variant="outline"
              />
            </View>
          ) : null}

          {result.status === "server-error" ? (
            <View className="gap-3">
              <Text className="text-destructive text-sm dark:text-dark-destructive">
                {result.message}
              </Text>
              <Button
                label={m["common.error.retry"]()}
                onPress={() => {
                  planQuery.refetch().catch(() => undefined);
                }}
                variant="outline"
              />
            </View>
          ) : null}

          {result.status === "unauthorized" ? (
            <Text className="text-muted-foreground text-sm dark:text-dark-muted-foreground">
              {m["common.sign.sign_in_title"]()}
            </Text>
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Write `apps/mobile/src/app/(tabs)/profile.tsx`**

```tsx
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { Text, View } from "react-native";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";

const MIN_NAME_LENGTH = 2;

export default function ProfileScreen() {
  const { data: session } = authClient.useSession();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const form = useForm({
    defaultValues: { name: session?.user.name ?? "" },
    onSubmit: async ({ value }) => {
      setError("");
      setSaved(false);
      const result = await authClient.updateUser({ name: value.name });
      if (result.error) {
        setError(result.error.message ?? "Update failed");
        return;
      }
      setSaved(true);
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(MIN_NAME_LENGTH, "Name is too short"),
      }),
    },
  });

  return (
    <Screen>
      <View className="gap-4 p-6">
        <Card title={m["common.nav.profile"]()}>
          <View className="gap-1">
            <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
              {m["settings.profile.email"]()}
            </Text>
            <Text className="text-foreground text-sm dark:text-dark-foreground">
              {session?.user.email ?? ""}
            </Text>
          </View>

          <form.Field name="name">
            {(field) => (
              <Input
                autoComplete="name"
                errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                label={m["settings.profile.name"]()}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                disabled={!canSubmit}
                label={
                  isSubmitting
                    ? m["settings.profile.saving"]()
                    : m["settings.profile.save"]()
                }
                loading={isSubmitting}
                onPress={() => {
                  form.handleSubmit();
                }}
              />
            )}
          </form.Subscribe>

          {saved ? (
            <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
              {m["settings.profile.saved"]()}
            </Text>
          ) : null}

          {error.length > 0 ? (
            <Text className="text-destructive text-sm dark:text-dark-destructive">
              {error}
            </Text>
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 3: Write `apps/mobile/src/app/(tabs)/settings.tsx`**

```tsx
import type { SupportedLocale } from "@openstarter/i18n";
import { SUPPORTED_LOCALES } from "@openstarter/i18n";
import Constants from "expo-constants";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { useAppLocale } from "@/lib/i18n";
import type { ThemePreference } from "@/lib/preferences";
import { useThemePreference } from "@/lib/theme";
import { m } from "@/paraglide/messages.js";

const THEME_OPTIONS: readonly ThemePreference[] = ["light", "dark", "system"];

const THEME_LABELS: Record<ThemePreference, () => string> = {
  dark: () => m["common.nav.theme_dark"](),
  light: () => m["common.nav.theme_light"](),
  system: () => m["common.nav.theme_system"](),
};

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  zh: "中文",
};

export default function SettingsScreen() {
  const { preference, setPreference } = useThemePreference();
  const { locale, setAppLocale } = useAppLocale();

  return (
    <Screen>
      <View className="gap-4 p-6">
        <Card title={m["mobile.settings.appearance"]()}>
          <View className="gap-2">
            {THEME_OPTIONS.map((option) => (
              <Button
                key={option}
                label={THEME_LABELS[option]()}
                onPress={() => setPreference(option)}
                variant={option === preference ? "primary" : "outline"}
              />
            ))}
          </View>
        </Card>

        <Card title={m["common.nav.language"]()}>
          <View className="gap-2">
            {SUPPORTED_LOCALES.map((option) => (
              <Button
                key={option}
                label={LOCALE_LABELS[option]}
                onPress={() => setAppLocale(option)}
                variant={option === locale ? "primary" : "outline"}
              />
            ))}
          </View>
        </Card>

        <Card>
          <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
              {m["mobile.settings.version"]()}
            </Text>
            <Text className="text-foreground text-sm dark:text-dark-foreground">
              {Constants.expoConfig?.version ?? "-"}
            </Text>
          </View>
        </Card>

        <Button
          label={m["common.sign.sign_out_title"]()}
          onPress={() => {
            authClient.signOut().catch(() => undefined);
          }}
          variant="outline"
        />
      </View>
    </Screen>
  );
}
```

`useThemePreference` and `useAppLocale` are called here as well as in the root layout. Both are safe to call twice: the theme hook re-applies the same value it just read from storage, and the locale hook's one-time `setLocale` lives at module scope, so mounting it again only reads state. If a future change makes either hook stateful in a way that breaks this, lift them into a context provider — do not paper over it with a `useRef` guard.

- [ ] **Step 4: Type-check and lint**

```bash
pnpm --filter mobile check-types
pnpm lint
```

Expected: both PASS. If `session?.user.name` is typed as possibly `undefined`, use `session?.user.name ?? ""` (already the case in `defaultValues`).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/app/\(tabs\)
git commit -m "feat(mobile): add home, profile, and settings screens"
```

---

## Task 15: EAS profiles and the manual verification pass

**Files:**
- Modify: `apps/mobile/eas.json` (only if Step 2 shows a profile needs adjusting)

**Interfaces:**
- Consumes: everything from Tasks 1–14.
- Produces: nothing new. This is the spec's §8.4 checklist — the only non-automated gate in the plan, and the only place OAuth deep-link return, SecureStore persistence, and the config-driven login page are actually proven.

Do not mark this task complete without recording the outcome of every numbered check. "It compiles" is not evidence that any of this works.

- [ ] **Step 1: Start the backend and point the app at it**

Find the development machine's LAN address, then write it into `apps/mobile/.env`:

```bash
ipconfig getifaddr en0
```

Set `EXPO_PUBLIC_API_URL=http://<that-address>:3000` in `apps/mobile/.env`. Start the backend as a background process: `pnpm dev:web`. Confirm it answers from the LAN address, not just localhost:

```bash
curl -s http://<that-address>:3000/api/health
```

Expected: a JSON body with an `ok` status. If this fails while `curl http://localhost:3000/api/health` succeeds, the dev server is bound to loopback only and the device will never reach it — that is a host configuration issue to resolve before continuing.

- [ ] **Step 2: Produce a development build**

Expo Go is not sufficient: its URL scheme is not the app's own, so the OAuth callback cannot return to the app (spec §8.4 item 2).

With an Expo account:

```bash
pnpm --filter mobile exec npx eas build --profile development --platform android
```

Without an Expo account, build locally instead (requires Xcode or Android Studio):

```bash
pnpm --filter mobile ios
pnpm --filter mobile android
```

Install the resulting build on the device or simulator, then start the bundler with `pnpm dev:mobile` as a background process.

- [ ] **Step 3: Run every check and record the result**

1. Launch with no session → the sign-in screen appears, not the tab bar.
2. Register a new account with email/password → if the server requires email verification, the pending-verification message appears; otherwise the app lands on the Home tab.
3. Sign in with email/password → Home tab shows the account email and the plan badge from `GET /api/user/plan`.
4. Kill the app completely and reopen → still signed in, and **no frame of the sign-in screen flashes** (this is what `deriveAuthGate`'s loading branch protects).
5. Sign in with Google → the system browser opens the consent page → after approval the app is foregrounded via `openstarter://` and is signed in.
6. In the web admin, turn `google_auth_enabled` off → force-close and reopen the app → the Google button is gone from the sign-in screen.
7. Set `EXPO_PUBLIC_API_URL` to `not-a-url`, restart the bundler → the configuration-error screen appears with the reason, not a spinner and not a network error.
8. Restore the correct URL. Revoke the session server-side (delete the session row, or sign out from the web app in a way that invalidates it) → pull the Home tab's retry or reopen the app → the 401 signs the user out and returns to the sign-in screen with **no error toast**.
9. Switch theme to Dark, switch language to 中文, kill and reopen the app → both choices persist and the UI renders in Chinese with dark colors.
10. Apple sign-in — requires a physical iOS device and an Apple Developer account. If unavailable, record it as "not verified, needs device" rather than as passing.

- [ ] **Step 4: Record the outcome**

Write the ten results into the commit body (or the PR description). If a check failed, fix it and re-run the affected check before finishing this task.

- [ ] **Step 5: Stop background processes**

Stop `pnpm dev:web` and `pnpm dev:mobile`.

- [ ] **Step 6: Commit only if Step 3 required changes**

If checks 1–10 passed with no code changes, there is nothing to commit here beyond the recorded results. Otherwise:

```bash
git add apps/mobile
git commit -m "fix(mobile): resolve issues found during manual verification"
```

---

## Task 16: Full-repo verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Type-check the whole monorepo**

```bash
pnpm check-types
```

Expected: PASS, including the new `mobile` package.

- [ ] **Step 2: Run the whole test suite**

```bash
pnpm test
```

Expected: PASS. The output must include a `mobile` project with the tests from Tasks 5–9 (env 7, api-error 13, auth-gate 6, public-config 7, locale 10 = 43 tests), plus `@openstarter/i18n`'s parity test covering the new message keys.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: PASS. `apps/mobile` has no `build` script, so Turbo skips it — confirm the output shows it skipped rather than failed.

- [ ] **Step 5: Confirm nothing generated or secret is tracked**

```bash
git status --short
```

Expected: empty. Specifically, none of `apps/mobile/.env`, `apps/mobile/.expo/`, `apps/mobile/src/paraglide/`, `apps/mobile/ios/`, or `apps/mobile/android/` may appear. If any does, fix `apps/mobile/.gitignore` (Task 4 Step 11) before considering the plan complete.

- [ ] **Step 6: Confirm the type-only boundary held**

```bash
grep -rn "@openstarter/api" apps/mobile/src
```

Expected: exactly one hit — `import type { AppType } from "@openstarter/api";` in `src/lib/api.ts`. Any value import here would pull the server dependency graph into the Metro bundle.

```bash
grep -rn "@openstarter/db\|@openstarter/ui-web\|@openstarter/auth/server\|from \"@openstarter/shared\"" apps/mobile/src
```

Expected: no output.

- [ ] **Step 7: Commit any fixes from the steps above**

If Steps 1–6 required changes, commit them with a message naming what was fixed. If everything passed untouched, there is nothing to commit.

---

## Deviations from the spec, and why

Two things in this plan are not in the spec document, both discovered while writing it:

1. **Root `vitest.config.ts` must be modified** (Task 5 Step 2). The spec's §8.1 change table lists root `package.json` and `biome.jsonc` but not `vitest.config.ts`. That config enumerates test projects explicitly and no glob covers `apps/mobile`, so without the addition the mobile tests would pass locally via `--filter` and silently never run in `pnpm test`.

2. **`GET /api/config/public` cannot report missing OAuth env credentials** (Task 8). The server requires both the admin switch and the client id/secret env vars before registering a provider, but only the switch is exposed. A provider with the switch on and credentials missing still renders a button that 404s. `apps/web` has the identical gap, so this plan mirrors web's behaviour rather than diverging on one client; fixing it belongs in the endpoint.
