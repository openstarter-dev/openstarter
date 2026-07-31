# Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/desktop` 从一个未提交的 Electron 骨架变成模板中可交付的桌面端：远程加载线上站点、能在本机产出三平台安装包、并支持通过 GitHub Releases 自动更新。

**Architecture:** 一份 TypeScript 代码两种运行模式（dev 加载本地 web dev server，prod 加载构建时注入的站点 URL），按 `app.isPackaged` 区分。主进程按职责拆成纯逻辑模块（`config`/`security`/`window-state`/`menu`/`updater`/`log`，均可在纯 Node 环境下被 vitest 覆盖）和薄的 Electron 集成层（`window`/`preload`/`main`）。esbuild 把 TS 编译成 CJS，electron-builder 打包并接 electron-updater。

**Tech Stack:** TypeScript（继承仓库 `tsconfig.base.json`）、esbuild 0.28.1、Electron 43.2.0、electron-builder 26.15.3、electron-updater 6.8.9、Vitest（复用仓库 `vitest`/`@vitest/coverage-v8` 4.1.10）。

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-01-desktop-app-design.md` — 下面每个任务都对应到其中的一节，任务描述里标出 `spec §N`。
- 依赖版本精确锁定，不用范围符：`electron@43.2.0`、`electron-builder@26.15.3`（devDependency）、`electron-updater@6.8.9`、`esbuild@0.28.1`（devDependency）。这四个只在 `apps/desktop/package.json` 里声明，不进 `pnpm-workspace.yaml` 的 catalog（spec §3）。
- 运行模式判断用 `app.isPackaged`，不用 `NODE_ENV`（spec §4）。
- 全仓库不用 `console`；日志经 `apps/desktop/src/log.ts` 的 `logInfo`/`logWarn`/`logError` 写 `process.stdout`/`process.stderr`（spec §5，参照 `packages/shared/src/logger.ts` 的既有先例）。
- 不引入 `electron-store`、`concurrently`、`wait-on`、`playwright-electron` 等额外依赖，保持仓库"零额外 dev 依赖"的风格（spec §5、§10）。
- 目录职责严格分离且不能混用默认名（spec §6）：
  - `apps/desktop/dist/` — esbuild 编译产物，`.gitignore` 忽略
  - `apps/desktop/release/` — electron-builder 安装包输出（`directories.output`），`.gitignore` 忽略
  - `apps/desktop/build-resources/` — 图标等打包资源（`directories.buildResources`），**必须提交**（不能叫 `build`，根 `.gitignore` 第 8 行的 `build` 规则会吞掉任意层级的同名目录）
  - `apps/desktop/resources/` — 打进 app 的静态文件（`offline.html`），必须提交
- macOS target 必须同时含 `dmg` 和 `zip`：`electron-updater` 在 macOS 上读取的是 zip 元数据，只配 dmg 会导致自动更新失效（spec §6）。
- esbuild 只把 `electron` 标记为 external，其余依赖（含 `electron-updater`）全部 bundle 进产物，不改动 pnpm 的 hoisting 配置（spec §6）。
- `config.ts` 的解析函数不抛异常，返回带原因的失败结果；生产模式下解析失败时创建窗口并直接加载兜底页，而不是让主进程在 `whenReady` 之前抛错退出（spec §8）。
- 新增/修改文件必须让 `pnpm lint`（ultracite/biome）在改动范围内保持干净，不写入 `.ultracite-baseline.json`（spec §10）。
- 每个任务结束后运行 `pnpm --filter desktop test` 或根 `pnpm vitest --run --project desktop`（视该任务是否已建好 vitest 项目）确认新增测试通过；涉及跨包改动时运行 `pnpm check-types`。
- 所有 git commit 用 Conventional Commits（英文），代码注释可用中文（与仓库既有风格一致）。

---

## Task 1: 新增 `apps/desktop/vitest.config.ts` 并注册到根配置

**Files:**
- Create: `apps/desktop/vitest.config.ts`
- Modify: `vitest.config.ts:26` （`test.projects` 数组）

**Interfaces:**
- Consumes: 无
- Produces: `apps/desktop` 成为一个具名为 `desktop` 的 vitest project，`include: ["src/**/*.test.ts"]`，`environment: "node"`。后续所有任务的 `*.test.ts` 都依赖这个项目已注册，否则测试跑不到。

这个任务先行，是因为它本身不需要任何源码就能验证——用一个占位测试确认 project 被正确发现。

- [ ] **Step 1: 创建 `apps/desktop/vitest.config.ts`**

```typescript
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    name: "desktop",
  },
});
```

- [ ] **Step 2: 把 `apps/desktop` 加入根 `vitest.config.ts` 的 `test.projects`**

读取当前内容确认第 23 行附近的数组，在 `"apps/web/vitest.config.ts",` 之后插入一行：

```typescript
    projects: [
      "apps/web/vitest.config.ts",
      "apps/desktop/vitest.config.ts",
      "packages/*/vitest.config.ts",
      "packages/*/*/vitest.config.ts",
      "scripts/vitest.config.ts",
    ],
```

- [ ] **Step 3: 建一个占位测试确认 project 被发现**

创建 `apps/desktop/src/log.test.ts`（这个文件在 Task 2 会被真正的测试替换，这里先写一个最小可通过的占位，确认 vitest 能找到并跑这个 project）：

```typescript
import { describe, expect, it } from "vitest";

describe("desktop vitest project", () => {
  it("is discovered by the root config", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 4: 运行确认 project 被发现且通过**

Run: `pnpm vitest --run --project desktop`
Expected: 输出包含 `desktop`，`1 passed`（或类似的 1 个测试通过），退出码 0。

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/vitest.config.ts apps/desktop/src/log.test.ts vitest.config.ts
git commit -m "test(desktop): register desktop vitest project"
```

---

## Task 2: `log.ts` —— 统一日志封装

**Files:**
- Create: `apps/desktop/src/log.ts`
- Modify: `apps/desktop/src/log.test.ts`（替换 Task 1 的占位内容）

**Interfaces:**
- Consumes: 无
- Produces:
  - `logInfo(...args: unknown[]): void`
  - `logWarn(...args: unknown[]): void`
  - `logError(...args: unknown[]): void`
  - 三者都在消息前加 `[desktop]` 前缀；`logInfo` 写 `process.stdout`，`logWarn`/`logError` 写 `process.stderr`。后续所有模块（`config`/`security`/`window`/`updater`/`main`）都用这三个函数记录日志，禁止直接用 `console`。

- [ ] **Step 1: 写测试**

替换 `apps/desktop/src/log.test.ts` 全部内容为：

```typescript
import { describe, expect, it, vi } from "vitest";

import { logError, logInfo, logWarn } from "./log";

describe("log", () => {
  it("logInfo writes a prefixed line to stdout", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    logInfo("server ready", "on port", 3000);

    expect(spy).toHaveBeenCalledTimes(1);
    const [line] = spy.mock.calls[0] as [string];
    expect(line).toContain("[desktop]");
    expect(line).toContain("server ready");
    expect(line).toContain("on port");
    expect(line).toContain("3000");
    expect(line.endsWith("\n")).toBe(true);

    spy.mockRestore();
  });

  it("logWarn writes a prefixed line to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    logWarn("update check skipped");

    expect(spy).toHaveBeenCalledTimes(1);
    const [line] = spy.mock.calls[0] as [string];
    expect(line).toContain("[desktop]");
    expect(line).toContain("update check skipped");

    spy.mockRestore();
  });

  it("logError writes a prefixed line to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    logError("failed to load", new Error("boom"));

    expect(spy).toHaveBeenCalledTimes(1);
    const [line] = spy.mock.calls[0] as [string];
    expect(line).toContain("[desktop]");
    expect(line).toContain("failed to load");

    spy.mockRestore();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest --run --project desktop`
Expected: FAIL，报 `Cannot find module './log'` 或类似的模块找不到错误。

- [ ] **Step 3: 实现 `apps/desktop/src/log.ts`**

```typescript
// apps/desktop/src/log.ts —— 桌面端统一日志封装。
//
// 全仓库不直接使用 console（ultracite/biome 的 noConsole 规则约束），主进程与各纯逻辑
// 模块统一经这三个函数落日志，写入 process.stdout / process.stderr 并带 [desktop] 前缀。
// 参照 packages/shared/src/logger.ts 的既有先例。

const PREFIX = "[desktop]";

function writeLine(
  stream: NodeJS.WritableStream,
  args: unknown[]
): void {
  const message = args
    .map((arg) => (arg instanceof Error ? arg.stack ?? arg.message : String(arg)))
    .join(" ");
  stream.write(`${PREFIX} ${message}\n`);
}

export function logInfo(...args: unknown[]): void {
  writeLine(process.stdout, args);
}

export function logWarn(...args: unknown[]): void {
  writeLine(process.stderr, args);
}

export function logError(...args: unknown[]): void {
  writeLine(process.stderr, args);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest --run --project desktop`
Expected: PASS，3 个测试全部通过。

- [ ] **Step 5: Lint 检查**

Run: `pnpm ultracite:check apps/desktop/src/log.ts apps/desktop/src/log.test.ts`

若命令不存在该用法，改用：`node scripts/check-quality.mjs`（会自动发现新增文件）。
Expected: 无错误输出。

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/log.ts apps/desktop/src/log.test.ts
git commit -m "feat(desktop): add log module for console-free logging"
```

---

## Task 3: `config.ts` —— 站点 URL 与更新配置解析

**Files:**
- Create: `apps/desktop/src/config.ts`
- Create: `apps/desktop/src/config.test.ts`

**Interfaces:**
- Consumes: 无（纯函数，输入均为参数或 `process.env`）
- Produces：
  - `type ResolvedUrl = { ok: true; url: string } | { ok: false; reason: string }`
  - `resolveAppUrl(params: { isPackaged: boolean; buildTimeUrl: string; env: Record<string, string | undefined> }): ResolvedUrl`
  - `type DesktopMode = "dev" | "prod"`
  - `getDesktopMode(isPackaged: boolean): DesktopMode`
  - `isUpdaterDisabled(env: Record<string, string | undefined>): boolean`

  Task 9（`main.ts`）消费 `getDesktopMode`/`resolveAppUrl` 编排启动流程；`window.ts` 内部消费 `resolveAppUrl` 的返回值决定 `loadURL` 还是加载兜底页；`security.ts` 消费 `resolveAppUrl` 成功时的 `url` 算出白名单 origin。Task 11（`updater.ts`）消费 `isUpdaterDisabled`——`main.ts` 不直接调用它，避免同一个开关判断分散在两个文件里（见 Task 11 的实现说明）。

**关于 URL 解析规则的具体决策（落实 spec §8）：**
- 输入必须能被 `new URL()` 解析，且 `protocol` 是 `http:` 或 `https:`；否则失败。
- 成功时返回值用 `url.toString()` 归一化（`https://a.com` 和 `https://a.com/` 统一变成 `https://a.com/`，见下方 Step 3 前的实测结果），不需要手写去尾斜杠逻辑。
- 优先级：`env.OPENSTARTER_DESKTOP_APP_URL`（运行时覆盖）> `buildTimeUrl`（构建时通过 esbuild `define` 注入）。
- dev 模式下如果两者都解析失败，回退到 `http://localhost:3000`。
- prod 模式下如果两者都解析失败，返回 `{ ok: false, reason: ... }`，不回退。

- [ ] **Step 1: 写测试**

创建 `apps/desktop/src/config.test.ts`：

```typescript
import { describe, expect, it } from "vitest";

import {
  getDesktopMode,
  isUpdaterDisabled,
  resolveAppUrl,
} from "./config";

describe("getDesktopMode", () => {
  it("returns dev when not packaged", () => {
    expect(getDesktopMode(false)).toBe("dev");
  });

  it("returns prod when packaged", () => {
    expect(getDesktopMode(true)).toBe("prod");
  });
});

describe("resolveAppUrl", () => {
  it("prefers the runtime env override over the build-time URL", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "https://build-time.example.com",
      env: { OPENSTARTER_DESKTOP_APP_URL: "https://runtime.example.com" },
      isPackaged: true,
    });

    expect(result).toEqual({ ok: true, url: "https://runtime.example.com/" });
  });

  it("falls back to the build-time URL when no runtime override is set", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "https://build-time.example.com",
      env: {},
      isPackaged: true,
    });

    expect(result).toEqual({ ok: true, url: "https://build-time.example.com/" });
  });

  it("normalizes a URL without a trailing slash", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "https://example.com",
      env: {},
      isPackaged: true,
    });

    expect(result).toEqual({ ok: true, url: "https://example.com/" });
  });

  it("rejects a non-http(s) protocol", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "file:///etc/passwd",
      env: {},
      isPackaged: true,
    });

    expect(result.ok).toBe(false);
  });

  it("rejects an unparsable string", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "not a url",
      env: {},
      isPackaged: true,
    });

    expect(result.ok).toBe(false);
  });

  it("falls back to localhost:3000 in dev when nothing resolves", () => {
    const result = resolveAppUrl({ buildTimeUrl: "", env: {}, isPackaged: false });

    expect(result).toEqual({ ok: true, url: "http://localhost:3000/" });
  });

  it("returns a failure result in prod when nothing resolves, without throwing", () => {
    const result = resolveAppUrl({ buildTimeUrl: "", env: {}, isPackaged: true });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("prefers a valid runtime override even if the build-time URL is invalid", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "not a url",
      env: { OPENSTARTER_DESKTOP_APP_URL: "https://runtime.example.com" },
      isPackaged: true,
    });

    expect(result).toEqual({ ok: true, url: "https://runtime.example.com/" });
  });

  it("falls back to the build-time URL when the runtime override is invalid", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "https://build-time.example.com",
      env: { OPENSTARTER_DESKTOP_APP_URL: "not a url" },
      isPackaged: true,
    });

    expect(result).toEqual({ ok: true, url: "https://build-time.example.com/" });
  });
});

describe("isUpdaterDisabled", () => {
  it("is false when the env var is unset", () => {
    expect(isUpdaterDisabled({})).toBe(false);
  });

  it("is true when the env var is 'true'", () => {
    expect(isUpdaterDisabled({ OPENSTARTER_DESKTOP_DISABLE_UPDATER: "true" })).toBe(
      true
    );
  });

  it("is false for any other value", () => {
    expect(isUpdaterDisabled({ OPENSTARTER_DESKTOP_DISABLE_UPDATER: "false" })).toBe(
      false
    );
    expect(isUpdaterDisabled({ OPENSTARTER_DESKTOP_DISABLE_UPDATER: "1" })).toBe(
      false
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest --run --project desktop`
Expected: FAIL，`Cannot find module './config'`。

- [ ] **Step 3: 实现 `apps/desktop/src/config.ts`**

```typescript
// apps/desktop/src/config.ts —— 站点 URL 与更新配置解析（纯函数，无 Electron 依赖）。
//
// 运行模式判断依据 app.isPackaged，不用 NODE_ENV（打包后的 app 里环境变量不可控，见
// docs/superpowers/specs/2026-08-01-desktop-app-design.md §4）。
//
// URL 解析失败时返回带原因的失败结果而不抛异常：主进程在 whenReady 之前抛错会得到一个
// 没有任何窗口的静默失败进程，用户双击图标后什么都不会发生（见 spec §8）。

export type DesktopMode = "dev" | "prod";

export type ResolvedUrl =
  | { ok: true; url: string }
  | { ok: false; reason: string };

const DEV_FALLBACK_URL = "http://localhost:3000";

/** 依据 app.isPackaged 判断运行模式。 */
export function getDesktopMode(isPackaged: boolean): DesktopMode {
  return isPackaged ? "prod" : "dev";
}

/** 校验并归一化一个候选 URL：必须是 http/https，返回值经 URL.toString() 归一化。 */
function normalizeUrl(candidate: string): string | null {
  if (!candidate) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  return parsed.toString();
}

type ResolveAppUrlParams = {
  buildTimeUrl: string;
  env: Record<string, string | undefined>;
  isPackaged: boolean;
};

/**
 * 解析生产模式加载的站点 URL。
 * 优先级：运行时环境变量覆盖 > 构建时注入的默认值。
 * dev 模式下两者都解析失败时回退到 localhost:3000；prod 模式下返回失败结果。
 */
export function resolveAppUrl(params: ResolveAppUrlParams): ResolvedUrl {
  const { buildTimeUrl, env, isPackaged } = params;
  const mode = getDesktopMode(isPackaged);

  const runtimeOverride = normalizeUrl(env.OPENSTARTER_DESKTOP_APP_URL ?? "");
  if (runtimeOverride) {
    return { ok: true, url: runtimeOverride };
  }

  const fromBuildTime = normalizeUrl(buildTimeUrl);
  if (fromBuildTime) {
    return { ok: true, url: fromBuildTime };
  }

  if (mode === "dev") {
    return { ok: true, url: `${DEV_FALLBACK_URL}/` };
  }

  return {
    ok: false,
    reason:
      "No valid app URL configured. Set OPENSTARTER_DESKTOP_APP_URL or rebuild with a valid default URL.",
  };
}

/** 是否显式关闭自动更新检查（OPENSTARTER_DESKTOP_DISABLE_UPDATER=true）。 */
export function isUpdaterDisabled(env: Record<string, string | undefined>): boolean {
  return env.OPENSTARTER_DESKTOP_DISABLE_UPDATER === "true";
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest --run --project desktop`
Expected: PASS，全部测试通过（Task 1/2 的测试 + 本任务新增的 14 个测试）。

- [ ] **Step 5: Lint 检查**

Run: `node scripts/check-quality.mjs`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/config.ts apps/desktop/src/config.test.ts
git commit -m "feat(desktop): add config module for URL and updater resolution"
```

---

## Task 4: `security.ts` —— 导航白名单与安全策略处理器

**Files:**
- Create: `apps/desktop/src/security.ts`
- Create: `apps/desktop/src/security.test.ts`

**Interfaces:**
- Consumes: 无
- Produces：
  - `isAllowedNavigation(targetUrl: string, allowedOrigin: string): boolean`
  - `type ExternalOpener = (url: string) => void`
  - `createWindowOpenHandler(openExternal: ExternalOpener): (details: { url: string }) => { action: "allow" | "deny" }`（不接收 origin，见下方实现说明）
  - `createWillNavigateHandler(allowedOrigin: string, openExternal: ExternalOpener): (event: { preventDefault: () => void }, url: string) => void`
  - `createPermissionRequestHandler(): (webContents: unknown, permission: string, callback: (granted: boolean) => void) => void`

  Task 8（`window.ts`）与 Task 9（`main.ts`）消费这四个工厂函数，把返回的处理器接到真实的 Electron `webContents` 事件上。

**关于白名单判定的具体规则（落实 spec §9）：**
- 用 `new URL(targetUrl).origin === new URL(allowedOrigin).origin` 判断同源；`origin` 天然包含 protocol + hostname + port，因此协议差异（http vs https）、端口差异、大小写差异（`URL` 会自动把 hostname 转小写）都被覆盖，不需要额外分支。
- 子域不放宽：`app.example.com` 和 `evil.app.example.com` 的 `origin` 不同，天然被拒绝，不需要额外逻辑。
- 伪协议（`javascript:`、`file:`、`data:`）：`new URL(...).origin` 对这些协议返回字符串 `"null"`，天然不等于任何 `allowedOrigin`，天然被拒绝。
- `targetUrl` 解析失败（畸形字符串）时，`isAllowedNavigation` 返回 `false`（不抛异常）。

- [ ] **Step 1: 写测试**

创建 `apps/desktop/src/security.test.ts`：

```typescript
import { describe, expect, it, vi } from "vitest";

import {
  createPermissionRequestHandler,
  createWillNavigateHandler,
  createWindowOpenHandler,
  isAllowedNavigation,
} from "./security";

const ALLOWED_ORIGIN = "https://app.example.com";

describe("isAllowedNavigation", () => {
  it("allows the same origin", () => {
    expect(isAllowedNavigation("https://app.example.com/login", ALLOWED_ORIGIN)).toBe(
      true
    );
  });

  it("allows the same origin with different casing", () => {
    expect(isAllowedNavigation("https://APP.EXAMPLE.COM/login", ALLOWED_ORIGIN)).toBe(
      true
    );
  });

  it("rejects a subdomain", () => {
    expect(
      isAllowedNavigation("https://evil.app.example.com", ALLOWED_ORIGIN)
    ).toBe(false);
  });

  it("rejects a different protocol on the same host", () => {
    expect(isAllowedNavigation("http://app.example.com", ALLOWED_ORIGIN)).toBe(
      false
    );
  });

  it("rejects a different port", () => {
    expect(isAllowedNavigation("https://app.example.com:8443", ALLOWED_ORIGIN)).toBe(
      false
    );
  });

  it("rejects javascript: URLs", () => {
    expect(isAllowedNavigation("javascript:alert(1)", ALLOWED_ORIGIN)).toBe(false);
  });

  it("rejects file: URLs", () => {
    expect(isAllowedNavigation("file:///etc/passwd", ALLOWED_ORIGIN)).toBe(false);
  });

  it("rejects data: URLs", () => {
    expect(isAllowedNavigation("data:text/html,hi", ALLOWED_ORIGIN)).toBe(false);
  });

  it("rejects an unparsable string without throwing", () => {
    expect(isAllowedNavigation("not a url", ALLOWED_ORIGIN)).toBe(false);
  });
});

describe("createWindowOpenHandler", () => {
  it("denies and forwards allowed-origin URLs to the external opener", () => {
    const openExternal = vi.fn();
    const handler = createWindowOpenHandler(openExternal);

    const result = handler({ url: "https://app.example.com/help" });

    expect(result).toEqual({ action: "deny" });
    expect(openExternal).toHaveBeenCalledWith("https://app.example.com/help");
  });

  it("denies and forwards external URLs to the external opener", () => {
    const openExternal = vi.fn();
    const handler = createWindowOpenHandler(openExternal);

    const result = handler({ url: "https://accounts.google.com/oauth" });

    expect(result).toEqual({ action: "deny" });
    expect(openExternal).toHaveBeenCalledWith("https://accounts.google.com/oauth");
  });
});

describe("createWillNavigateHandler", () => {
  it("does not prevent navigation within the allowed origin", () => {
    const openExternal = vi.fn();
    const preventDefault = vi.fn();
    const handler = createWillNavigateHandler(ALLOWED_ORIGIN, openExternal);

    handler({ preventDefault }, "https://app.example.com/settings");

    expect(preventDefault).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("prevents navigation outside the allowed origin and opens it externally", () => {
    const openExternal = vi.fn();
    const preventDefault = vi.fn();
    const handler = createWillNavigateHandler(ALLOWED_ORIGIN, openExternal);

    handler({ preventDefault }, "https://accounts.google.com/oauth");

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternal).toHaveBeenCalledWith("https://accounts.google.com/oauth");
  });
});

describe("createPermissionRequestHandler", () => {
  it("denies every permission request", () => {
    const handler = createPermissionRequestHandler();
    const callback = vi.fn();

    handler({}, "notifications", callback);

    expect(callback).toHaveBeenCalledWith(false);
  });

  it("denies clipboard requests too", () => {
    const handler = createPermissionRequestHandler();
    const callback = vi.fn();

    handler({}, "clipboard-read", callback);

    expect(callback).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest --run --project desktop`
Expected: FAIL，`Cannot find module './security'`。

- [ ] **Step 3: 实现 `apps/desktop/src/security.ts`**

```typescript
// apps/desktop/src/security.ts —— 导航白名单纯判定 + 安全策略处理器工厂。
//
// 远程加载模式下渲染进程执行的是远端代码，这里是防止远端页面在 app 内获得不该有能力的
// 最后一道边界。判定只依赖 URL.origin 的相等性：origin 天然编码了 protocol/host/port，
// 天然处理大小写；子域因 origin 不同而天然被拒绝；伪协议（javascript:/file:/data:）的
// origin 恒为字符串 "null"，天然不等于任何合法 allowedOrigin。
// 详见 docs/superpowers/specs/2026-08-01-desktop-app-design.md §9。

/** 判断 targetUrl 是否与 allowedOrigin 同源。解析失败（畸形字符串）返回 false，不抛异常。 */
export function isAllowedNavigation(targetUrl: string, allowedOrigin: string): boolean {
  try {
    return new URL(targetUrl).origin === new URL(allowedOrigin).origin;
  } catch {
    return false;
  }
}

export type ExternalOpener = (url: string) => void;

type WindowOpenHandlerDetails = { url: string };
type WindowOpenHandlerResult = { action: "allow" | "deny" };

/**
 * 生成 setWindowOpenHandler 的处理器：任何新窗口请求（含站内的 target=_blank 链接和
 * OAuth 跳转）一律拒绝原生窗口创建，转交系统浏览器打开。不接收 allowedOrigin——
 * window.open() 触发的新窗口请求无论站内站外都统一转发，不需要按 origin 分流
 * （站内 target=_blank 链接本就该在系统浏览器里打开，不必留在 app 窗口内）。
 */
export function createWindowOpenHandler(
  openExternal: ExternalOpener
): (details: WindowOpenHandlerDetails) => WindowOpenHandlerResult {
  return (details) => {
    openExternal(details.url);
    return { action: "deny" };
  };
}

type WillNavigateEvent = { preventDefault: () => void };

/**
 * 生成 will-navigate 的处理器：站内导航放行，站外导航阻止并转系统浏览器。
 * allowedOrigin 参数目前未在函数体内直接使用比较（isAllowedNavigation 内联判断），
 * 保留显式参数是为了让调用方在构造时就能看清这个处理器绑定的是哪个 origin。
 */
export function createWillNavigateHandler(
  allowedOrigin: string,
  openExternal: ExternalOpener
): (event: WillNavigateEvent, url: string) => void {
  return (event, url) => {
    if (isAllowedNavigation(url, allowedOrigin)) {
      return;
    }
    event.preventDefault();
    openExternal(url);
  };
}

type PermissionCallback = (granted: boolean) => void;

/** 生成 setPermissionRequestHandler 的处理器：默认拒绝一切权限请求。 */
export function createPermissionRequestHandler(): (
  webContents: unknown,
  permission: string,
  callback: PermissionCallback
) => void {
  return (_webContents, _permission, callback) => {
    callback(false);
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest --run --project desktop`
Expected: PASS，全部测试通过。

- [ ] **Step 5: Lint 检查**

Run: `node scripts/check-quality.mjs`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/security.ts apps/desktop/src/security.test.ts
git commit -m "feat(desktop): add security module for navigation allowlisting"
```

---

## Task 5: `window-state.ts` —— 窗口尺寸位置的解析、校验、读写

**Files:**
- Create: `apps/desktop/src/window-state.ts`
- Create: `apps/desktop/src/window-state.test.ts`

**Interfaces:**
- Consumes: 无
- Produces：
  - `type WindowState = { width: number; height: number; x?: number; y?: number }`
  - `const DEFAULT_WINDOW_STATE: WindowState`（`{ width: 1280, height: 800 }`）
  - `parseWindowState(raw: string): WindowState`（解析失败或越界一律回退到 `DEFAULT_WINDOW_STATE`，不抛异常）
  - `serializeWindowState(state: WindowState): string`
  - `type WindowStateStore = { read: () => WindowState; write: (state: WindowState) => void }`
  - `createFileWindowStateStore(filePath: string): WindowStateStore`

  Task 8（`window.ts`）消费 `createFileWindowStateStore` 在窗口创建时读取初始状态、在 `close` 事件里写入最新状态；`filePath` 由 `main.ts` 用 `app.getPath("userData")` 拼出后传入。

**关于校验规则（落实 spec §5"窗口尺寸位置持久化"一节）：**
- `width`/`height` 必须是正整数，且分别不小于 200；超出这个下限或非数字/非整数，回退默认值的对应字段。
- `x`/`y` 可选；只要不是有限数字（`Number.isFinite`）就丢弃该字段（不设置，让 Electron 自己居中）。
- JSON 解析失败（语法错误、非对象）整体回退到 `DEFAULT_WINDOW_STATE`。

- [ ] **Step 1: 写测试**

创建 `apps/desktop/src/window-state.test.ts`：

```typescript
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createFileWindowStateStore,
  DEFAULT_WINDOW_STATE,
  parseWindowState,
  serializeWindowState,
} from "./window-state";

describe("parseWindowState", () => {
  it("parses a valid state", () => {
    const state = parseWindowState(
      JSON.stringify({ height: 900, width: 1400, x: 10, y: 20 })
    );

    expect(state).toEqual({ height: 900, width: 1400, x: 10, y: 20 });
  });

  it("parses a valid state without position", () => {
    const state = parseWindowState(JSON.stringify({ height: 900, width: 1400 }));

    expect(state).toEqual({ height: 900, width: 1400 });
  });

  it("falls back to the default on malformed JSON", () => {
    expect(parseWindowState("{not json")).toEqual(DEFAULT_WINDOW_STATE);
  });

  it("falls back to the default on a JSON array", () => {
    expect(parseWindowState("[1, 2, 3]")).toEqual(DEFAULT_WINDOW_STATE);
  });

  it("falls back to the default when width is below the minimum", () => {
    const state = parseWindowState(JSON.stringify({ height: 900, width: 10 }));

    expect(state.width).toBe(DEFAULT_WINDOW_STATE.width);
    expect(state.height).toBe(900);
  });

  it("falls back to the default when height is not a number", () => {
    const state = parseWindowState(
      JSON.stringify({ height: "tall", width: 1400 })
    );

    expect(state.height).toBe(DEFAULT_WINDOW_STATE.height);
    expect(state.width).toBe(1400);
  });

  it("drops a non-finite x/y instead of failing the whole state", () => {
    const state = parseWindowState(
      JSON.stringify({ height: 900, width: 1400, x: Number.POSITIVE_INFINITY })
    );

    expect(state).toEqual({ height: 900, width: 1400 });
  });
});

describe("serializeWindowState / parseWindowState round-trip", () => {
  it("round-trips a full state", () => {
    const original = { height: 768, width: 1024, x: 5, y: 5 };

    expect(parseWindowState(serializeWindowState(original))).toEqual(original);
  });
});

describe("createFileWindowStateStore", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { force: true, recursive: true });
    }
    dirs.length = 0;
  });

  it("read() returns the default when the file does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "openstarter-window-state-"));
    dirs.push(dir);
    const store = createFileWindowStateStore(join(dir, "window-state.json"));

    expect(store.read()).toEqual(DEFAULT_WINDOW_STATE);
  });

  it("write() then read() round-trips through the filesystem", () => {
    const dir = mkdtempSync(join(tmpdir(), "openstarter-window-state-"));
    dirs.push(dir);
    const store = createFileWindowStateStore(join(dir, "window-state.json"));

    store.write({ height: 700, width: 1500, x: 1, y: 2 });

    expect(store.read()).toEqual({ height: 700, width: 1500, x: 1, y: 2 });
  });

  it("read() returns the default when the file contains corrupted JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "openstarter-window-state-"));
    dirs.push(dir);
    const filePath = join(dir, "window-state.json");
    const store = createFileWindowStateStore(filePath);
    store.write({ height: 700, width: 1500 });

    // 模拟文件被破坏（例如进程在写入过程中被杀死）。
    writeFileSync(filePath, "{corrupted");

    expect(store.read()).toEqual(DEFAULT_WINDOW_STATE);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest --run --project desktop`
Expected: FAIL，`Cannot find module './window-state'`。

- [ ] **Step 3: 实现 `apps/desktop/src/window-state.ts`**

```typescript
// apps/desktop/src/window-state.ts —— 窗口尺寸位置的解析、校验、文件持久化。
//
// 不引入 electron-store，用 app.getPath("userData") 下的一个 JSON 文件即可（与仓库
// 既有的"零额外 dev 依赖"风格一致，见 spec §5）。单独成文件是因为"解析一个可能已损坏的
// JSON 状态文件"本身值得测——状态文件损坏导致启动崩溃是个真实故障模式。

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export type WindowState = {
  height: number;
  width: number;
  x?: number;
  y?: number;
};

export const DEFAULT_WINDOW_STATE: WindowState = {
  height: 800,
  width: 1280,
};

const MIN_DIMENSION = 200;

function isValidDimension(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_DIMENSION
  );
}

/** 解析一个候选窗口状态字符串；任何格式或取值问题都回退到默认值，不抛异常。 */
export function parseWindowState(raw: string): WindowState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_WINDOW_STATE };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...DEFAULT_WINDOW_STATE };
  }

  const candidate = parsed as Record<string, unknown>;
  const width = isValidDimension(candidate.width)
    ? candidate.width
    : DEFAULT_WINDOW_STATE.width;
  const height = isValidDimension(candidate.height)
    ? candidate.height
    : DEFAULT_WINDOW_STATE.height;

  const state: WindowState = { height, width };

  if (typeof candidate.x === "number" && Number.isFinite(candidate.x)) {
    state.x = candidate.x;
  }
  if (typeof candidate.y === "number" && Number.isFinite(candidate.y)) {
    state.y = candidate.y;
  }

  return state;
}

/** 序列化窗口状态为可写入文件的 JSON 字符串。 */
export function serializeWindowState(state: WindowState): string {
  return JSON.stringify(state);
}

export type WindowStateStore = {
  read: () => WindowState;
  write: (state: WindowState) => void;
};

/** 基于单个 JSON 文件的窗口状态存取。读取时任何异常（文件不存在/损坏）都回退到默认值。 */
export function createFileWindowStateStore(filePath: string): WindowStateStore {
  return {
    read: () => {
      if (!existsSync(filePath)) {
        return { ...DEFAULT_WINDOW_STATE };
      }
      try {
        return parseWindowState(readFileSync(filePath, "utf8"));
      } catch {
        return { ...DEFAULT_WINDOW_STATE };
      }
    },
    write: (state) => {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, serializeWindowState(state));
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest --run --project desktop`
Expected: PASS，全部测试通过。

- [ ] **Step 5: Lint 检查**

Run: `node scripts/check-quality.mjs`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/window-state.ts apps/desktop/src/window-state.test.ts
git commit -m "feat(desktop): add window-state module for persisted window bounds"
```

---

## Task 6: `menu.ts` —— 应用菜单模板

**Files:**
- Create: `apps/desktop/src/menu.ts`
- Create: `apps/desktop/src/menu.test.ts`

**Interfaces:**
- Consumes: 无（`import type { MenuItemConstructorOptions } from "electron"` 只是类型导入，编译后被擦除，不产生 `require("electron")`）
- Produces: `buildMenuTemplate(isMac: boolean): MenuItemConstructorOptions[]`

  Task 9（`main.ts`）消费 `buildMenuTemplate(process.platform === "darwin")`，传给 `Menu.buildFromTemplate` 再 `Menu.setApplicationMenu`。

**为什么这个模块存在（落实 spec §5"menu.ts 不是可选项"）：** 远程加载的页面在 Electron 里默认拿不到 `Cmd+C`/`Cmd+V`/`Cmd+A`，这些快捷键依赖应用菜单中带 `role` 的菜单项存在。测试断言模板里存在这几个 role，防止未来有人把这个"看起来像样板代码"的模块当冗余删掉。

- [ ] **Step 1: 写测试**

创建 `apps/desktop/src/menu.test.ts`：

```typescript
import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it } from "vitest";

import { buildMenuTemplate } from "./menu";

function collectRoles(items: MenuItemConstructorOptions[]): string[] {
  const roles: string[] = [];
  for (const item of items) {
    if (typeof item.role === "string") {
      roles.push(item.role);
    }
    if (Array.isArray(item.submenu)) {
      roles.push(...collectRoles(item.submenu as MenuItemConstructorOptions[]));
    }
  }
  return roles;
}

describe("buildMenuTemplate", () => {
  it("includes the clipboard roles required for Cmd/Ctrl+C/V/A to work", () => {
    const roles = collectRoles(buildMenuTemplate(false));

    expect(roles).toContain("copy");
    expect(roles).toContain("paste");
    expect(roles).toContain("selectAll");
    expect(roles).toContain("cut");
    expect(roles).toContain("undo");
    expect(roles).toContain("redo");
  });

  it("includes the clipboard roles on macOS too", () => {
    const roles = collectRoles(buildMenuTemplate(true));

    expect(roles).toContain("copy");
    expect(roles).toContain("paste");
    expect(roles).toContain("selectAll");
  });

  it("adds a macOS app menu (about/hide/quit) only when isMac is true", () => {
    const macRoles = collectRoles(buildMenuTemplate(true));
    const otherRoles = collectRoles(buildMenuTemplate(false));

    expect(macRoles).toContain("about");
    expect(macRoles).toContain("hide");
    expect(otherRoles).not.toContain("hide");
  });

  it("always provides a way to quit", () => {
    const macRoles = collectRoles(buildMenuTemplate(true));
    const otherRoles = collectRoles(buildMenuTemplate(false));

    expect(macRoles).toContain("quit");
    expect(otherRoles).toContain("quit");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest --run --project desktop`
Expected: FAIL，`Cannot find module './menu'`。

- [ ] **Step 3: 实现 `apps/desktop/src/menu.ts`**

```typescript
// apps/desktop/src/menu.ts —— 应用菜单模板（纯数据，无 Electron 运行时依赖）。
//
// 远程加载的页面在 Electron 里默认拿不到 Cmd+C / Cmd+V / Cmd+A —— 这些快捷键依赖应用
// 菜单中带 role 的菜单项存在。没有菜单，复制粘贴静默失效。因此这个模块不是可选项，
// 属于最小可用集（见 spec §5）。只做 `import type`，编译期擦除，不产生对 electron 的
// 运行时依赖，模板本身可在纯 Node 环境下被 vitest 覆盖。

import type { MenuItemConstructorOptions } from "electron";

/** 构造应用菜单模板。isMac 为 true 时加入 macOS 专属的 App 菜单与编辑菜单扩展项。 */
export function buildMenuTemplate(isMac: boolean): MenuItemConstructorOptions[] {
  const appMenu: MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: "OpenStarter",
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
      ]
    : [];

  const fileMenu: MenuItemConstructorOptions = {
    label: "File",
    submenu: [isMac ? { role: "close" } : { role: "quit" }],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: "Window",
    submenu: [
      { role: "minimize" },
      isMac ? { role: "close" } : { role: "quit" },
    ],
  };

  return [...appMenu, fileMenu, editMenu, viewMenu, windowMenu];
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest --run --project desktop`
Expected: PASS，全部测试通过。

注意：`menu.test.ts` 里 `import type { MenuItemConstructorOptions } from "electron"` 需要 `electron` 包已安装且其类型声明可解析。若 Task 7 尚未安装 `electron` 依赖，这一步的类型检查（不是运行时）可能报错——`electron` 已经在现有骨架的 `package.json` 里声明为 devDependency，`pnpm install` 已装好，这里只是复用其类型定义，不需要额外安装。

- [ ] **Step 5: Lint 检查**

Run: `node scripts/check-quality.mjs`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/menu.ts apps/desktop/src/menu.test.ts
git commit -m "feat(desktop): add menu module with clipboard-enabling roles"
```

---

## Task 7: `preload.ts` —— contextBridge 最小 API

**Files:**
- Create: `apps/desktop/src/preload.ts`

**Interfaces:**
- Consumes: `ipcRenderer.invoke("desktop:retry")`（Task 9 的 `main.ts` 用 `ipcMain.handle("desktop:retry", ...)` 提供实现）
- Produces: 渲染进程全局 `window.desktop = { platform: string; retry: () => Promise<void> }`

这个文件没有单测（运行时依赖 `electron` 的 `contextBridge`/`ipcRenderer`，属于薄集成层，spec §5 里标注为"无"）。正确性在 Task 12 的人工验收清单里靠"兜底页的重试按钮能工作"间接验证。

只暴露 `platform` 和 `retry`，没有 `version`——spec §4 提到的最小 API 原本包含版本号，
但当前唯一的消费者（`resources/offline.html`）根本不需要它，YAGNI。真要加，正确做法
是走一次 `ipcMain.handle("desktop:version", () => app.getVersion())`，不能直接读
`process.env.npm_package_version`：preload 运行在 renderer 进程里，这个变量只在被
npm/pnpm 脚本启动的子进程中存在，打包后 app 由用户双击启动，不经过任何 npm 脚本，
该值会一直是空字符串。

- [ ] **Step 1: 实现 `apps/desktop/src/preload.ts`**

```typescript
// apps/desktop/src/preload.ts —— 唯一的主进程/渲染进程桥。
//
// 通过 contextBridge 暴露最小 API，不暴露任何 Node 原语。retry() 只服务于兜底页
// （resources/offline.html）：远程站点页面虽然也能看到 window.desktop，但 retry()
// 只能触发主进程重新加载已白名单的 URL，不构成额外攻击面（见 spec §4）。
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  retry: () => ipcRenderer.invoke("desktop:retry"),
});
```

- [ ] **Step 2: Lint 检查**

Run: `node scripts/check-quality.mjs`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/preload.ts
git commit -m "feat(desktop): add preload bridge with minimal contextBridge API"
```

---

## Task 8: `resources/offline.html` + `window.ts` —— 窗口创建与失败降级

**Files:**
- Create: `apps/desktop/resources/offline.html`
- Create: `apps/desktop/src/window.ts`

**Interfaces:**
- Consumes:
  - `resolveAppUrl`、`ResolvedUrl`（Task 3 的 `config.ts`）
  - `isAllowedNavigation`、`createWindowOpenHandler`、`createWillNavigateHandler`、`createPermissionRequestHandler`、`ExternalOpener`（Task 4 的 `security.ts`）
  - `createFileWindowStateStore`、`WindowStateStore`（Task 5 的 `window-state.ts`）
  - `logInfo`、`logWarn`（Task 2 的 `log.ts`）
- Produces:
  - `type CreateWindowParams = { resolvedUrl: ResolvedUrl; windowStateStore: WindowStateStore }`
  - `function createMainWindow(params: CreateWindowParams): BrowserWindow`
  - `function waitForDevServer(url: string, attempts?: number, intervalMs?: number): Promise<boolean>`
  - `function applyGlobalWebContentsPolicy(): void`

  Task 9（`main.ts`）消费 `createMainWindow`（并需要拿到返回的 `BrowserWindow` 实例去注册 `ipcMain.handle("desktop:retry", ...)`，重试时重新调用同样的加载逻辑）、`waitForDevServer`（dev 模式启动前轮询）、`applyGlobalWebContentsPolicy`（启动时调用一次，挂载全局策略）。

这个文件没有单测——它是运行时依赖 `electron` 的薄集成层（spec §5）。正确性在 Task 12 的验收清单第 1、5 条里人工验证。

- [ ] **Step 1: 创建 `apps/desktop/resources/offline.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenStarter</title>
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0a0a0a;
        color: #f5f5f5;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      main {
        text-align: center;
        max-width: 28rem;
        padding: 2rem;
      }
      h1 {
        font-size: 1.25rem;
        margin-bottom: 0.5rem;
      }
      p {
        color: #a3a3a3;
        line-height: 1.5;
      }
      button {
        margin-top: 1.5rem;
        padding: 0.5rem 1.5rem;
        border-radius: 0.375rem;
        border: 1px solid #404040;
        background: #171717;
        color: #f5f5f5;
        font-size: 0.875rem;
        cursor: pointer;
      }
      button:hover {
        background: #262626;
      }
    </style>
  </head>
  <body>
    <main>
      <h1 id="title">Can't reach the app</h1>
      <p id="message">
        Check your internet connection, then try again.
      </p>
      <button type="button" id="retry-button">Retry</button>
    </main>
    <script>
      const params = new URLSearchParams(window.location.search);
      const reason = params.get("reason");
      if (reason === "config") {
        document.getElementById("title").textContent =
          "App URL not configured";
        document.getElementById("message").textContent =
          "The desktop app doesn't have a valid site URL configured. Set OPENSTARTER_DESKTOP_APP_URL or rebuild with a valid default URL.";
      }
      document
        .getElementById("retry-button")
        .addEventListener("click", () => {
          window.desktop?.retry();
        });
    </script>
  </body>
</html>
```

- [ ] **Step 2: 实现 `apps/desktop/src/window.ts`**

```typescript
// apps/desktop/src/window.ts —— 创建主窗口、加载站点或兜底页、安全策略挂载。
//
// 这是唯一持有 BrowserWindow 生命周期的模块。所有决策（白名单判定、URL 解析、窗口状态
// 校验）都来自纯逻辑模块，这里只做 Electron API 的搭接（见 spec §5）。
import { join } from "node:path";
import { BrowserWindow, app, shell } from "electron";

import type { ResolvedUrl } from "./config";
import { logInfo, logWarn } from "./log";
import {
  createPermissionRequestHandler,
  createWillNavigateHandler,
  createWindowOpenHandler,
} from "./security";
import type { WindowStateStore } from "./window-state";

const OFFLINE_PAGE_PATH = join(__dirname, "..", "resources", "offline.html");
const PRELOAD_PATH = join(__dirname, "preload.cjs");

function loadOfflinePage(win: BrowserWindow, reason?: "config" | "network"): void {
  const query = reason ? `?reason=${reason}` : "";
  win.loadFile(OFFLINE_PAGE_PATH, { search: query });
}

export type CreateWindowParams = {
  resolvedUrl: ResolvedUrl;
  windowStateStore: WindowStateStore;
};

/** 创建主窗口：站点 URL 有效则加载站点并挂载安全策略，否则直接加载兜底页。 */
export function createMainWindow(params: CreateWindowParams): BrowserWindow {
  const { resolvedUrl, windowStateStore } = params;
  const initialState = windowStateStore.read();

  const win = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0a",
    height: initialState.height,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRELOAD_PATH,
      sandbox: true,
    },
    width: initialState.width,
    x: initialState.x,
    y: initialState.y,
  });

  const persistState = () => {
    const bounds = win.getBounds();
    windowStateStore.write({
      height: bounds.height,
      width: bounds.width,
      x: bounds.x,
      y: bounds.y,
    });
  };
  win.on("close", persistState);

  const openExternal: (url: string) => void = (url) => {
    shell.openExternal(url).catch((error) => {
      logWarn("failed to open external URL", url, error);
    });
  };

  if (!resolvedUrl.ok) {
    logWarn("no valid app URL configured:", resolvedUrl.reason);
    loadOfflinePage(win, "config");
    return win;
  }

  const allowedOrigin = new URL(resolvedUrl.url).origin;
  win.webContents.setWindowOpenHandler(createWindowOpenHandler(openExternal));
  win.webContents.on(
    "will-navigate",
    createWillNavigateHandler(allowedOrigin, openExternal)
  );
  win.webContents.session.setPermissionRequestHandler(
    createPermissionRequestHandler()
  );
  win.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }
      logWarn(`failed to load ${resolvedUrl.url}:`, errorCode, errorDescription);
      loadOfflinePage(win, "network");
    }
  );

  logInfo("loading", resolvedUrl.url);
  win.loadURL(resolvedUrl.url);

  return win;
}

/** dev 模式专用：轮询等待本地 web dev server 就绪，避免过早 loadURL 打到还没起来的端口。 */
export async function waitForDevServer(
  url: string,
  attempts = 60,
  intervalMs = 500
): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: sequential polling against a single dev server is intentional.
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok || res.status === 404) {
        return true;
      }
    } catch {
      // dev server not up yet
    }
    await delay(intervalMs);
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 挂载全局 webContents 策略：任何新建的 webContents（不只是主窗口）都拒绝 webview 附加。
 * 落实 spec §9 "策略挂在 app.on('web-contents-created') 上而非只挂主窗口"。
 * 由 main.ts 在启动时显式调用一次，不作为模块顶层副作用——避免这个文件被以任何方式
 * import 时都无条件触碰 Electron 的 app 单例。
 */
export function applyGlobalWebContentsPolicy(): void {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });
  });
}
```

关于这个文件的几个实现细节说明：

- `setPermissionRequestHandler` 挂在 `webContents.session` 上，不是 `webContents` 本身（已用 Electron 33 的 `electron.d.ts` 类型定义核实）。
- `win.loadFile(path, { search })` 是 Electron 的标准写法，`search` 参数会拼到 `file://` URL 后面，`offline.html` 里用 `URLSearchParams(window.location.search)` 读取。
- `applyGlobalWebContentsPolicy()` 里的兜底拦截是防止子 webContents（如 `<webview>`）绕过主窗口策略，落实 spec §9 "策略挂在 web-contents-created 上而非只挂主窗口"；主窗口自身的 `will-attach-webview` 监听器是双重保险，两者不冲突（`preventDefault()` 是幂等操作）。这个函数导出后由 `main.ts` 显式调用一次（见 Task 9），不是模块顶层副作用——`window.ts` 被 import 时不应该无条件触碰 `app` 单例。
- `waitForDevServer` 从旧的 `main.cjs` 迁移过来，改成蛇形变量名和显式 `delay` 辅助函数以满足 `noAwaitInLoops`（已用 biome 实测确认这个写法能通过 lint，见下方 Step 3）。

- [ ] **Step 3: Lint 检查**

Run: `node scripts/check-quality.mjs`
Expected: 无错误。若报 `noAwaitInLoops`，确认 `delay` 辅助函数确实是独立声明的函数（不是内联箭头函数），这是让 biome 判断"这不是一个可以并行化的 await"的关键。

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/resources/offline.html apps/desktop/src/window.ts
git commit -m "feat(desktop): add window module with offline fallback and nav policy"
```

---

## Task 9: `main.ts` —— 生命周期编排，删除旧 `main.cjs`，接入 esbuild 构建

**Files:**
- Create: `apps/desktop/src/main.ts`
- Create: `apps/desktop/scripts/build.mjs`
- Delete: `apps/desktop/src/main.cjs`（若存在——该文件从未提交到 git，执行时工作区里可能已经没有它，见 Step 3）
- Modify: `apps/desktop/package.json`（`main` 字段、`scripts`、依赖版本）
- Modify: `apps/desktop/tsconfig.json`（继承 `tsconfig.base.json`，移除 `allowJs`/`checkJs`）
- Create: `scripts/run-desktop.mjs`（该文件同样从未提交到 git；Step 6 给出完整内容，无论执行时它是否已存在都可以直接写入）

**Interfaces:**
- Consumes: 前 8 个任务的全部导出（`getDesktopMode`/`resolveAppUrl`/`isUpdaterDisabled` from `config.ts`；`createMainWindow`/`waitForDevServer` from `window.ts`；`createFileWindowStateStore` from `window-state.ts`；`buildMenuTemplate` from `menu.ts`；`logInfo`/`logWarn`/`logError` from `log.ts`）
- Produces: 无导出（`main.ts` 是入口脚本，没有其他文件 import 它）。这个任务结束后 `pnpm dev:desktop` 应该能跑起来，对应 spec §13 实现顺序的"第 2 层：可跑起来"。

站点 URL 的构建时默认值通过 esbuild `define` 注入为全局常量 `__OPENSTARTER_DESKTOP_APP_URL__`，`main.ts` 直接引用这个标识符（不是 `process.env`）。

- [ ] **Step 1: 实现 `apps/desktop/src/main.ts`**

```typescript
// apps/desktop/src/main.ts —— 主进程生命周期编排。
//
// dev 模式：等待本地 web dev server 就绪后加载 http://localhost:3000。
// prod 模式：加载构建时注入的站点 URL（可被运行时环境变量覆盖），失败时降级到兜底页。
// 具体决策全部来自纯逻辑模块（config/security/window-state/menu），这里只做编排。
import { join } from "node:path";
import { app, BrowserWindow, ipcMain, Menu } from "electron";

import { getDesktopMode, resolveAppUrl } from "./config";
import { logError, logInfo, logWarn } from "./log";
import { buildMenuTemplate } from "./menu";
import { maybeCheckForUpdates } from "./updater";
import {
  applyGlobalWebContentsPolicy,
  createMainWindow,
  waitForDevServer,
} from "./window";
import { createFileWindowStateStore } from "./window-state";

// esbuild 在构建时通过 define 注入的全局常量，见 scripts/build.mjs。
declare const __OPENSTARTER_DESKTOP_APP_URL__: string;

const UPDATE_CHECK_DELAY_MS = 10_000;

async function main(): Promise<void> {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  const { isPackaged } = app;
  const mode = getDesktopMode(isPackaged);

  applyGlobalWebContentsPolicy();

  Menu.setApplicationMenu(
    Menu.buildFromTemplate(buildMenuTemplate(process.platform === "darwin"))
  );

  await app.whenReady();

  if (mode === "dev") {
    const devUrl = process.env.OPENSTARTER_DESKTOP_APP_URL ?? "http://localhost:3000";
    logInfo("waiting for dev server at", devUrl);
    const ready = await waitForDevServer(devUrl);
    if (!ready) {
      logWarn(`dev server ${devUrl} did not respond in time; loading anyway.`);
    }
  }

  const resolvedUrl = resolveAppUrl({
    buildTimeUrl: __OPENSTARTER_DESKTOP_APP_URL__,
    env: process.env,
    isPackaged,
  });

  const windowStateStore = createFileWindowStateStore(
    join(app.getPath("userData"), "window-state.json")
  );

  let currentWindow = createMainWindow({ resolvedUrl, windowStateStore });

  ipcMain.handle("desktop:retry", () => {
    currentWindow.close();
    currentWindow = createMainWindow({ resolvedUrl, windowStateStore });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      currentWindow = createMainWindow({ resolvedUrl, windowStateStore });
    }
  });

  // 是否检查、检查什么条件，全部由 maybeCheckForUpdates 内部判断（含 isUpdaterDisabled）；
  // 这里只负责延迟调度，不重复判断一次开关，避免两处逻辑分叉。
  setTimeout(() => {
    maybeCheckForUpdates(isPackaged).catch((error) => {
      logError("update check failed", error);
    });
  }, UPDATE_CHECK_DELAY_MS);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

main().catch((error) => {
  logError("fatal error during startup", error);
  app.quit();
});
```

注意：这里临时引用了尚未创建的 `./updater` 模块（`maybeCheckForUpdates`）。Task 11 会创建它。在 Task 11 完成之前，这个文件无法通过类型检查——**这是本计划里唯一一处允许"先写引用、后补实现"的地方**，因为 `main.ts` 是编排层，必须在一个地方就把完整的生命周期串起来才有意义；如果你严格按顺序执行到这一步，请继续往下做 Task 10（打包）后再做 Task 11（updater），届时类型检查会自动通过。若你想让每个任务后仓库都能独立跑 `tsc --noEmit`，可以把 Task 11 提前到这里之前，两者顺序对调不影响正确性。

注意 `outExtension: { ".js": ".cjs" }` 是必需的一行，不是可选优化——esbuild 默认按
`format` 只决定语法（CJS `require`/`module.exports` vs ESM `import`/`export`），
输出文件后缀始终是 `.js`，不会自动跟随 `format` 变成 `.cjs`（已用 esbuild 0.28.1
实测确认：省略这一行会产出 `dist/main.js` / `dist/preload.js`，导致 `package.json`
的 `main` 字段和 `window.ts` 里 `join(__dirname, "preload.cjs")` 全部找不到文件）。

- [ ] **Step 2: 创建 `apps/desktop/scripts/build.mjs`**

```javascript
// apps/desktop/scripts/build.mjs —— 用 esbuild 把 src/{main,preload}.ts 编译成
// dist/{main,preload}.cjs。只把 electron 标记为 external，其余依赖（含 electron-updater）
// 全部打进产物：pnpm 的 symlink 式 node_modules 与 electron-builder 的依赖收集历来不兼容，
// 全部 bundle 后就不需要处理这个问题（见 docs/superpowers/specs/2026-08-01-desktop-app-design.md §6）。
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = resolve(desktopDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const buildTimeUrl =
  process.env.OPENSTARTER_DESKTOP_APP_URL ?? "https://example.com";

async function build() {
  await esbuild.build({
    bundle: true,
    define: {
      __OPENSTARTER_DESKTOP_APP_URL__: JSON.stringify(buildTimeUrl),
    },
    entryPoints: [
      resolve(desktopDir, "src/main.ts"),
      resolve(desktopDir, "src/preload.ts"),
    ],
    external: ["electron"],
    format: "cjs",
    outExtension: { ".js": ".cjs" },
    outdir: resolve(desktopDir, "dist"),
    platform: "node",
    target: "node20",
  });

  process.stdout.write(
    `[desktop] built dist/main.cjs and dist/preload.cjs for ${packageJson.name}@${packageJson.version}\n`
  );
}

build().catch((error) => {
  process.stderr.write(`[desktop] build failed: ${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 3: 删除旧的 `apps/desktop/src/main.cjs`（如果存在）**

这个文件从未提交到 git（`git status` 里它只会出现在 untracked 列表，不会出现在
tracked 变更里）。执行前先确认：

```bash
ls apps/desktop/src/main.cjs 2>/dev/null && rm apps/desktop/src/main.cjs || echo "main.cjs already absent, nothing to remove"
```

不用 `git rm`——既然它从未被 git 跟踪，`git rm` 会报错找不到该文件。

- [ ] **Step 4: 更新 `apps/desktop/tsconfig.json`**

替换全部内容为：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node10",
    "ignoreDeprecations": "6.0",
    "noEmit": true,
    "outDir": "dist",
    "target": "ES2022",
    "types": ["node", "electron"]
  },
  "include": ["src/**/*.ts"]
}
```

说明：`module`/`moduleResolution` 覆盖 base 的 `ESNext`/`bundler`，因为 `main.ts` 用 `declare const __OPENSTARTER_DESKTOP_APP_URL__` 这种全局常量注入模式，配合 esbuild 的 CJS 输出；`types` 加入 `"electron"` 使 `electron.d.ts` 里的全局类型（如 `NodeJS.EventEmitter` 扩展）可用。

`moduleResolution` 必须写 `"node10"` 而不是 `"node"`：仓库用的是 `typescript@^6`（见
`pnpm-workspace.yaml` catalog），TS 6 把 `"node"` 视为 `"node10"` 的废弃别名并直接
报错退出（`TS5107`），不只是警告——已实测确认 `"node"` 在 TS 6 下让 `tsc --noEmit`
以非零退出码失败。`ignoreDeprecations: "6.0"` 是为了让这个显式选择不在未来 TS 版本
里被静默标红。

- [ ] **Step 5: 更新 `apps/desktop/package.json`**

```json
{
  "name": "desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/main.cjs",
  "scripts": {
    "dev": "node ../../scripts/run-desktop.mjs",
    "dev:electron": "cross-env NODE_ENV=development electron .",
    "build": "node scripts/build.mjs",
    "check-types": "tsc --noEmit",
    "test": "vitest --run"
  },
  "dependencies": {
    "electron-updater": "6.8.9"
  },
  "devDependencies": {
    "cross-env": "^7.0.3",
    "electron": "43.2.0",
    "electron-builder": "26.15.3",
    "esbuild": "0.28.1"
  }
}
```

说明：`electron-updater` 是 dependency（虽然被 esbuild bundle 进产物，仍需要在 `package.json` 里声明以便 `pnpm install` 解析其类型和间接依赖）；`electron`/`electron-builder`/`esbuild` 是 devDependency（构建期工具，不进最终产物或由 electron-builder 单独处理）。`package`/`release` 脚本留给 Task 10。

- [ ] **Step 6: 创建 `scripts/run-desktop.mjs`**

这个文件从未提交到 git，执行时工作区里可能已经不存在（或存在一个内容不同的版本）。
直接用下面的完整内容创建/覆盖，不做增量修改——内容基于此前探查到的原始实现（Node
内置 API 编排 dev 流程），新增的部分是开头的构建步骤：

```javascript
// scripts/run-desktop.mjs —— 编排 apps/desktop 的 dev 流程：
//   1. 先用 esbuild 编译一次 main/preload（否则 dist/main.cjs 不存在，Electron 无法启动）
//   2. 并行启动 apps/web 的 Vite dev server（端口 3000）
//   3. 等 web 就绪后，spawn Electron 主进程加载 http://localhost:3000
//   4. Ctrl-C 时优雅地把子进程都杀掉
//
// 设计取舍：不引入 concurrently / wait-on 等依赖，直接用 Node 内置 API 做进程编排，
// 与仓库现有"零额外 dev 依赖"风格保持一致。
//
// 本文件位于 scripts/ 目录，ultracite 配置对 **/scripts 路径的 noConsole 规则本就是
// off（已核实：ultracite/config/biome/core/biome.jsonc 第 656-666 行的 overrides），
// 因此这里直接用 console，不需要走 apps/desktop/src/log.ts 的 logInfo/logWarn。
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webDir = resolve(repoRoot, "apps/web");
const desktopDir = resolve(repoRoot, "apps/desktop");

const RENDERER_PORT = process.env.OPENSTARTER_RENDERER_PORT || "3000";
const RENDERER_URL = `http://localhost:${RENDERER_PORT}`;

// 递归杀掉子进程树（避免 vite/electron 留下孤儿进程）。
function killTree(proc) {
  if (!proc || proc.exitCode !== null) {
    return;
  }
  try {
    process.kill(proc.pid, "SIGTERM");
  } catch {
    // already dead
  }
}

function delay(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

// 等待 dev server 响应最多 attempts 次 HEAD 请求。
async function waitForDevServer(attempts = 80, intervalMs = 500) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: sequential polling against a single dev server is intentional.
      const res = await fetch(RENDERER_URL, { method: "HEAD" });
      if (res.ok || res.status === 404) {
        return true;
      }
    } catch {
      // not ready
    }
    await delay(intervalMs);
  }
  return false;
}

// 编译一次 main/preload；Electron 需要 dist/main.cjs 才能启动。
function runBuild() {
  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn("pnpm", ["run", "build"], {
      cwd: desktopDir,
      stdio: ["ignore", "inherit", "inherit"],
    });
    proc.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`desktop build exited with code ${code}`));
      }
    });
  });
}

function spawnWeb() {
  console.log("[desktop] starting web dev server (apps/web)...");
  const proc = spawn("pnpm", ["run", "dev"], {
    cwd: webDir,
    env: { ...process.env, PORT: RENDERER_PORT },
    stdio: ["ignore", "inherit", "inherit"],
  });
  proc.on("exit", (code) => {
    console.log(`[desktop] web dev server exited (code=${code})`);
  });
  return proc;
}

function spawnElectron() {
  console.log(`[desktop] launching electron -> ${RENDERER_URL}`);
  const proc = spawn("pnpm", ["run", "dev:electron"], {
    cwd: desktopDir,
    env: {
      ...process.env,
      NODE_ENV: "development",
      OPENSTARTER_DESKTOP_APP_URL: RENDERER_URL,
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  proc.on("exit", (code) => {
    console.log(`[desktop] electron exited (code=${code})`);
  });
  return proc;
}

async function main() {
  console.log("[desktop] building main/preload...");
  await runBuild();

  const webProc = spawnWeb();

  const ready = await waitForDevServer();
  if (!ready) {
    console.warn(
      `[desktop] web dev server not ready at ${RENDERER_URL}; launching electron anyway.`
    );
  }

  const electronProc = spawnElectron();

  // 任一进程退出 → 全部退出（dev 会话结束）。
  const exitAll = (code) => {
    killTree(webProc);
    killTree(electronProc);
    process.exit(code ?? 0);
  };
  webProc.on("exit", exitAll);
  electronProc.on("exit", exitAll);

  // Ctrl-C
  process.on("SIGINT", () => exitAll(0));
  process.on("SIGTERM", () => exitAll(0));
}

main().catch((err) => {
  console.error("[desktop] fatal:", err);
  process.exit(1);
});
```

注意这里把原来传给 Electron 的环境变量从 `OPENSTARTER_RENDERER_URL` 改成了
`OPENSTARTER_DESKTOP_APP_URL`——统一成 Task 3 的 `config.ts` 里 `resolveAppUrl` 实际
读取的变量名，两者原本不一致（旧骨架用的是前者，`config.ts` 的设计用的是后者）。

- [ ] **Step 7: 安装依赖**

Run: `pnpm install`
Expected: 命令成功完成，`node_modules` 更新，无致命错误。（会因新增/变更依赖版本触发 lockfile 更新；这是预期行为。）

- [ ] **Step 8: 类型检查（预期在此步骤失败，因为 `updater.ts` 还不存在）**

Run: `pnpm --filter desktop check-types`
Expected: FAIL，报 `Cannot find module './updater'`。这是预期的中间状态——继续做 Task 10（打包配置，不依赖 updater）或直接跳到 Task 11 补上 `updater.ts` 后回来重跑这一步。

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/main.ts apps/desktop/scripts/build.mjs apps/desktop/tsconfig.json apps/desktop/package.json scripts/run-desktop.mjs pnpm-lock.yaml
git commit -m "feat(desktop): add main process orchestration and esbuild build step"
```

---

## Task 10: `electron-builder.yml` + 图标 + 打包脚本

**Files:**
- Create: `apps/desktop/electron-builder.yml`
- Create: `apps/desktop/build-resources/icon.png`
- Modify: `apps/desktop/.gitignore`（补 `/release`）
- Modify: `apps/desktop/package.json`（新增 `package`/`release` 脚本）
- Modify: `package.json`（根，新增 `build:desktop`/`package:desktop`/`release:desktop`）

**Interfaces:**
- Consumes: `apps/desktop/dist/{main,preload}.cjs`（Task 9 的构建产物）、`apps/desktop/resources/offline.html`（Task 8）
- Produces: `apps/desktop/release/` 下的安装包（本任务不消费其他模块的 TS 接口，是纯配置任务）

这个任务结束后对应 spec §13 实现顺序的"第 3 层：可分发"。

- [ ] **Step 1: 生成占位图标**

`build-resources/icon.png` 需要一张 1024×1024 的 PNG。用 Python（已确认本机可用 Pillow）生成一张纯色占位图：

```bash
mkdir -p apps/desktop/build-resources
python3 -c "
from PIL import Image, ImageDraw

size = 1024
img = Image.new('RGB', (size, size), (10, 10, 10))
draw = ImageDraw.Draw(img)
margin = size // 4
draw.ellipse(
    [margin, margin, size - margin, size - margin],
    fill=(79, 70, 229),
)
img.save('apps/desktop/build-resources/icon.png')
"
```

Run 后确认: `sips -g pixelWidth -g pixelHeight apps/desktop/build-resources/icon.png`
Expected: 输出 `pixelWidth: 1024` 和 `pixelHeight: 1024`。

- [ ] **Step 2: 创建 `apps/desktop/electron-builder.yml`**

```yaml
# apps/desktop/electron-builder.yml
#
# 打包配置。esbuild 已把除 electron 外的全部依赖 bundle 进 dist/，因此 files 只需要
# 编译产物、静态资源和 package.json —— 不需要 node_modules（显式声明 files 会覆盖
# electron-builder 默认的 node_modules 收集行为）。
# 详见 docs/superpowers/specs/2026-08-01-desktop-app-design.md §6。

appId: com.openstarter.desktop
productName: OpenStarter

directories:
  output: release
  buildResources: build-resources

files:
  - dist/**
  - resources/**
  - package.json

mac:
  target:
    - dmg
    - zip
  arch:
    - arm64
    - x64
  # electron-updater 在 macOS 上读取 zip 而非 dmg 的元数据；只配 dmg 会导致自动更新
  # 失效，zip 是必需项，不是可选项。
  #
  # 代码签名与公证（接入 Apple 证书后取消注释并填入实际值）：
  # notarize: true
  # identity: "Developer ID Application: Your Name (TEAMID)"

win:
  target:
    - nsis
  arch:
    - x64
  # 代码签名（接入证书后取消注释）：
  # certificateFile: path/to/cert.pfx
  # certificatePassword: ${env.WIN_CSC_KEY_PASSWORD}

linux:
  target:
    - AppImage
    - deb
  arch:
    - x64
  category: Utility

publish:
  provider: github
  owner: your-github-org
  repo: your-repo-name
  # 如需切换为自建静态托管（S3/R2/自有域名），改用 generic provider：
  # provider: generic
  # url: https://updates.yourdomain.com
```

- [ ] **Step 3: 更新 `apps/desktop/.gitignore`**

在文件末尾新增一行 `/release`：

```
/node_modules
/dist
/out
/build
*.tsbuildinfo
/release

# Environment & local files
.env*
!.env.example
.DS_Store

# Logs
*.log
pnpm-debug.log*

# Turbo
.turbo
```

- [ ] **Step 4: 更新 `apps/desktop/package.json` 的 `scripts`**

在现有 `scripts` 里新增两项：

```json
{
  "scripts": {
    "dev": "node ../../scripts/run-desktop.mjs",
    "dev:electron": "cross-env NODE_ENV=development electron .",
    "build": "node scripts/build.mjs",
    "package": "pnpm run build && electron-builder --publish never",
    "release": "pnpm run build && electron-builder --publish always",
    "check-types": "tsc --noEmit",
    "test": "vitest --run"
  }
}
```

- [ ] **Step 5: 更新根 `package.json` 的 `scripts`**

在 `"dev:desktop": "turbo -F desktop dev",` 之后新增三行：

```json
{
  "scripts": {
    "dev:desktop": "turbo -F desktop dev",
    "build:desktop": "pnpm --filter desktop build",
    "package:desktop": "pnpm --filter desktop package",
    "release:desktop": "pnpm --filter desktop release",
  }
}
```

- [ ] **Step 6: 验证 dmg/zip 与 buildResources 配置生效（不产出真实安装包，只做配置校验）**

Run: `pnpm --filter desktop exec electron-builder --help`
Expected: 命令能找到 `electron-builder` 二进制并打印帮助信息（确认 devDependency 安装成功、CLI 可执行）。

注：完整打包（`pnpm package:desktop`）需要 Task 9 的 `dist/main.cjs` 已存在（依赖 Task 11 的 `updater.ts` 补全后类型检查通过、`pnpm --filter desktop build` 成功）。真实出包验证放在 Task 12 的人工验收清单第 6 条。

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/electron-builder.yml apps/desktop/build-resources/icon.png apps/desktop/.gitignore apps/desktop/package.json package.json
git commit -m "feat(desktop): add electron-builder packaging config"
```

---

## Task 11: `updater.ts` —— 自动更新策略与调用封装

**Files:**
- Create: `apps/desktop/src/updater.ts`
- Create: `apps/desktop/src/updater.test.ts`
- Modify: `apps/desktop/src/main.ts`（此前引用了尚不存在的 `maybeCheckForUpdates`，现在补上，类型检查应转为通过）

**Interfaces:**
- Consumes: 无（`shouldCheckForUpdates` 是纯函数；`maybeCheckForUpdates` 内部动态 `import("electron-updater")`）
- Produces:
  - `shouldCheckForUpdates(params: { isPackaged: boolean; disabled: boolean; hasPublishConfig: boolean }): boolean`
  - `hasPublishConfig(resourcesPath: string): boolean`（检查 `app-update.yml` 是否存在于打包资源目录）
  - `async function maybeCheckForUpdates(isPackaged: boolean): Promise<void>`

  Task 9 的 `main.ts` 消费 `maybeCheckForUpdates`。

**关于策略的具体规则（落实 spec §7）：**
- `shouldCheckForUpdates` 是三个布尔值的真值表：只有 `isPackaged === true && disabled === false && hasPublishConfig === true` 时返回 `true`。
- `hasPublishConfig` 检查场景：electron-builder 在打包时会生成 `app-update.yml` 放进 `resources/`（此文件由 electron-builder 自动生成，不是我们手写的 `apps/desktop/resources/offline.html`，两者互不冲突，位于打包后 app 内的 `process.resourcesPath` 目录，与源码里的 `resources/` 是不同的运行时路径）。若该文件不存在（例如模板使用者还没跑过 `electron-builder --publish` 或没配置 `publish` 字段），说明没有可用的更新源，跳过检查并打印一次 warning，而不是让 `electron-updater` 自己抛出运行时错误。
- `maybeCheckForUpdates` 用动态 `import("electron-updater")`：让 `updater.ts` 顶层保持零 Electron/electron-updater 运行时依赖，`shouldCheckForUpdates`/`hasPublishConfig` 可以被 vitest 直接测，不需要 mock 整个 `electron-updater` 包。

- [ ] **Step 1: 写测试**

创建 `apps/desktop/src/updater.test.ts`：

```typescript
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { hasPublishConfig, shouldCheckForUpdates } from "./updater";

describe("shouldCheckForUpdates", () => {
  it("is true only when packaged, not disabled, and publish config exists", () => {
    expect(
      shouldCheckForUpdates({
        disabled: false,
        hasPublishConfig: true,
        isPackaged: true,
      })
    ).toBe(true);
  });

  it("is false when not packaged", () => {
    expect(
      shouldCheckForUpdates({
        disabled: false,
        hasPublishConfig: true,
        isPackaged: false,
      })
    ).toBe(false);
  });

  it("is false when explicitly disabled", () => {
    expect(
      shouldCheckForUpdates({
        disabled: true,
        hasPublishConfig: true,
        isPackaged: true,
      })
    ).toBe(false);
  });

  it("is false when no publish config is present", () => {
    expect(
      shouldCheckForUpdates({
        disabled: false,
        hasPublishConfig: false,
        isPackaged: true,
      })
    ).toBe(false);
  });

  it("is false when all three conditions fail", () => {
    expect(
      shouldCheckForUpdates({
        disabled: true,
        hasPublishConfig: false,
        isPackaged: false,
      })
    ).toBe(false);
  });
});

describe("hasPublishConfig", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { force: true, recursive: true });
    }
    dirs.length = 0;
  });

  it("returns false when app-update.yml does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "openstarter-updater-"));
    dirs.push(dir);

    expect(hasPublishConfig(dir)).toBe(false);
  });

  it("returns true when app-update.yml exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "openstarter-updater-"));
    dirs.push(dir);
    writeFileSync(join(dir, "app-update.yml"), "provider: github\n");

    expect(hasPublishConfig(dir)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest --run --project desktop`
Expected: FAIL，`Cannot find module './updater'`。

- [ ] **Step 3: 实现 `apps/desktop/src/updater.ts`**

```typescript
// apps/desktop/src/updater.ts —— 自动更新策略（纯函数）+ electron-updater 调用封装。
//
// shouldCheckForUpdates/hasPublishConfig 是纯函数，可在纯 Node 环境下被 vitest 覆盖。
// maybeCheckForUpdates 用动态 import 引入 electron-updater，使这个文件的顶层不产生
// 对 electron-updater 的静态依赖（该依赖只在 main.ts 实际调用时才加载）。
// 详见 docs/superpowers/specs/2026-08-01-desktop-app-design.md §7。
import { existsSync } from "node:fs";
import { join } from "node:path";

import { isUpdaterDisabled } from "./config";
import { logError, logInfo, logWarn } from "./log";

type ShouldCheckParams = {
  disabled: boolean;
  hasPublishConfig: boolean;
  isPackaged: boolean;
};

/** 三个条件必须同时满足才检查更新：已打包、未被显式禁用、存在可用的更新源配置。 */
export function shouldCheckForUpdates(params: ShouldCheckParams): boolean {
  return params.isPackaged && !params.disabled && params.hasPublishConfig;
}

/**
 * 检查打包资源目录下是否存在 electron-builder 生成的 app-update.yml。
 * 该文件缺失通常意味着模板使用者尚未配置 publish 字段或没跑过带 publish 的打包命令。
 */
export function hasPublishConfig(resourcesPath: string): boolean {
  return existsSync(join(resourcesPath, "app-update.yml"));
}

/**
 * 在满足 shouldCheckForUpdates 条件时触发一次检查。失败只记日志，不弹框
 * （远程模式下网络本就不稳，见 spec §7）。
 */
export async function maybeCheckForUpdates(isPackaged: boolean): Promise<void> {
  const disabled = isUpdaterDisabled(process.env);
  const configExists = hasPublishConfig(process.resourcesPath);

  if (!shouldCheckForUpdates({ disabled, hasPublishConfig: configExists, isPackaged })) {
    if (isPackaged && !disabled && !configExists) {
      logWarn("no publish config found; skipping update check.");
    }
    return;
  }

  try {
    const { autoUpdater } = await import("electron-updater");
    autoUpdater.logger = {
      debug: logInfo,
      error: logError,
      info: logInfo,
      warn: logWarn,
    };
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    logError("update check failed", error);
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest --run --project desktop`
Expected: PASS，全部测试通过。

- [ ] **Step 5: 类型检查（此时应转为通过，因为 `main.ts` 引用的 `maybeCheckForUpdates` 现已存在）**

Run: `pnpm --filter desktop check-types`
Expected: 无错误输出，退出码 0。

- [ ] **Step 6: Lint 检查**

Run: `node scripts/check-quality.mjs`
Expected: 无错误。

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/updater.ts apps/desktop/src/updater.test.ts
git commit -m "feat(desktop): add updater module with GitHub Releases auto-update"
```

---

## Task 12: 文档（`apps/desktop/README.md`、`.env.example`、根 README）+ 最终验收

**Files:**
- Create: `apps/desktop/README.md`
- Create: `apps/desktop/.env.example`
- Modify: `README.md`（根，"What's in the box" 表格 + "Available scripts" 列表）

**Interfaces:**
- Consumes: 无（纯文档任务）
- Produces: 无

这个任务结束后对应 spec §13 实现顺序的"第 4 层：可更新 + 可交接"，也是整个计划的最后一层。

- [ ] **Step 1: 创建 `apps/desktop/.env.example`**

```
# ─────────────────────────────────────────────────────────────────────────────
# openstarter / apps/desktop 环境变量样例
#
# 复制为 .env 后按需填写。留空时使用构建时注入的默认值或跳过对应功能。
# ─────────────────────────────────────────────────────────────────────────────

# 生产模式加载的站点 URL。留空则使用构建时通过 `OPENSTARTER_DESKTOP_APP_URL`
# 环境变量注入 apps/desktop/scripts/build.mjs 的默认值。设置此项可在不重新构建的
# 情况下切换 app 连接的站点（例如指向预发环境做 QA）。
OPENSTARTER_DESKTOP_APP_URL=

# 显式关闭自动更新检查。设为 "true" 关闭，其他任何值（含留空）都视为开启。
OPENSTARTER_DESKTOP_DISABLE_UPDATER=

# dev 模式下 web dev server 的端口，默认 3000。仅在需要与其他服务共用 3000 端口时修改。
OPENSTARTER_RENDERER_PORT=

# electron-builder --publish 发布到 GitHub Releases 时所需的 token（发版时设置，
# 不需要出现在开发环境的 .env 里）。
GH_TOKEN=
```

- [ ] **Step 2: 创建 `apps/desktop/README.md`**

```markdown
# @openstarter/desktop

Electron 桌面外壳：复用 `apps/web` 的同一套 UI 与 API，加载你部署好的站点 URL。
本地能出三平台安装包，并通过 GitHub Releases 支持自动更新。

## 定位

这不是一个离线优先的桌面应用——它是一个"远程加载"的外壳：生产环境下 app 会打开你
配置的站点 URL，行为等价于把该站点装进一个原生窗口。好处是内容更新不需要重新发版
桌面端；代价是完全离线时无法使用（会显示兜底页而不是白屏）。

## 开发

```bash
pnpm dev:desktop
```

这会启动 `apps/web` 的 Vite dev server（端口 3000）并等待其就绪，再打开一个加载
`http://localhost:3000` 的 Electron 窗口。

## 构建

```bash
pnpm build:desktop
```

用 esbuild 把 `src/main.ts` 和 `src/preload.ts` 编译成 `dist/*.cjs`。站点 URL 的
默认值在这一步通过 `OPENSTARTER_DESKTOP_APP_URL` 环境变量注入，例如：

```bash
OPENSTARTER_DESKTOP_APP_URL=https://app.yourdomain.com pnpm build:desktop
```

## 打包（本机出安装包，不发布）

```bash
pnpm package:desktop
```

产物在 `apps/desktop/release/`：macOS 出 `.dmg` + `.zip`，Windows 出 NSIS 安装包，
Linux 出 AppImage + `.deb`。这一步不会推送到 GitHub Releases。

## 发版

```bash
GH_TOKEN=<your-token> pnpm release:desktop
```

发版前必须：
1. 更新 `apps/desktop/package.json` 里的 `version`（electron-builder 和
   electron-updater 都从这里读版本号做比对，不会跟随根 `package.json`）。
2. 确认 `apps/desktop/electron-builder.yml` 里的 `publish.owner` / `publish.repo`
   已改成你自己的 GitHub 仓库。

## 模板使用者必改项

把这个模板变成你自己的产品前，至少要改：

| 位置 | 字段 | 说明 |
|---|---|---|
| `electron-builder.yml` | `appId` | 改成你自己的反向域名标识，如 `com.yourcompany.yourapp` |
| `electron-builder.yml` | `productName` | 窗口标题、安装包文件名里显示的产品名 |
| `electron-builder.yml` | `publish.owner` / `publish.repo` | 你的 GitHub 仓库，自动更新依赖这个 |
| `build-resources/icon.png` | — | 换成你自己的 1024×1024 图标，当前是占位图 |
| `package.json` | `version` | 每次发版前手动递增 |
| `.env` | `OPENSTARTER_DESKTOP_APP_URL` | 你部署好的站点地址（构建时注入，见上方"构建"一节）|

## 已知限制

**OAuth 登录在桌面端不可用。** 导航白名单只允许站内跳转，OAuth 登录会把用户导向
`accounts.google.com` 之类的第三方域，这会被识别为站外导航并转到系统浏览器打开，
登录完成后的回调落在浏览器而不是 app 窗口里，流程会断掉。即便把 OAuth 域加入白名单
也不完全可靠——Google 明确拒绝在嵌入式 webview 里完成 OAuth，会返回
`disallowed_useragent` 错误。

邮箱密码登录在窗口内完全可用，这是模板的默认登录方式。真正支持 OAuth 需要让登录流程
走系统浏览器 + 自定义协议（如 `openstarter://auth/callback`）唤回 app，这需要
`apps/web` / `packages/api` 侧配合签发一次性可交换 token，属于独立的后续工作。

**macOS 上未签名的 app 无法自动更新。** Apple 的 Squirrel.Mac 更新框架强制校验代码
签名，这一点无法通过配置绕过。在你接入 Apple Developer 证书（`electron-builder.yml`
里 `mac.notarize` / `mac.identity` 字段）之前，macOS 用户只能手动下载新版本安装。
Windows（NSIS）和 Linux（AppImage）未签名也能正常自动更新，Windows 会有一次
SmartScreen "未知发布者"警告。

## 后续项（本轮未做）

- CI 打包矩阵（GitHub Actions 跑三平台构建）
- 代码签名与 macOS 公证的实际接入（配置文件已留字段和注释）
- 应用内更新提示 UI（当前只有系统通知，下次启动生效）
- 托盘常驻、全局快捷键
- 离线数据 / 本地数据库
- OAuth 走系统浏览器 + deep link 回调

## 人工验收清单

自动化测试只覆盖纯逻辑模块（`config`/`security`/`window-state`/`menu`/`updater`）。
以下步骤需要手动验证，涉及真实的 Electron 窗口行为：

1. `pnpm dev:desktop` 能跑起来，窗口显示 web 首页
2. 窗口内可以用邮箱密码登录，进入登录后的应用路由
3. `Cmd+C` / `Cmd+V` / `Cmd+A`（Windows/Linux 用 `Ctrl`）在窗口内的输入框里生效
4. 点击站外链接（如页脚的外部链接）会在系统浏览器打开，不会在窗口内跳转
5. 停掉 web dev server 后重启 app，应显示兜底页；恢复 dev server 后点"Retry"按钮能重新加载成功
6. `pnpm package:desktop` 在本机能产出安装包；安装后启动，确认能连上 `.env` 里配置的站点 URL
7. 关闭 app 再重新打开，窗口的尺寸和位置应与关闭前一致
```

- [ ] **Step 3: 更新根 `README.md` 的 "What's in the box" 表格**

在现有表格里 `| Monorepo | Turborepo + pnpm workspaces |` 这一行之后新增一行：

```markdown
| Desktop      | Electron 外壳（远程加载 + electron-builder 打包 + 自动更新），见 `apps/desktop/README.md` |
```

- [ ] **Step 4: 更新根 `README.md` 的 "Available scripts" 列表**

在 `- \`pnpm db:local\`` 那一行之后新增：

```markdown
- `pnpm dev:desktop` — 启动桌面端（同时起 web dev server 与 Electron 窗口）
- `pnpm build:desktop` — 编译桌面端主进程/preload
- `pnpm package:desktop` — 本机打包出三平台安装包（不发布）
- `pnpm release:desktop` — 打包并发布到 GitHub Releases（需要 `GH_TOKEN`）
```

- [ ] **Step 5: Commit 文档**

```bash
git add apps/desktop/README.md apps/desktop/.env.example README.md
git commit -m "docs(desktop): add desktop README, env example, and root README updates"
```

- [ ] **Step 6: 全量验证——类型检查**

Run: `pnpm check-types`
Expected: 全部包（含 `desktop`）类型检查通过，退出码 0。

- [ ] **Step 7: 全量验证——测试**

Run: `pnpm vitest --run --project desktop`
Expected: 全部桌面端测试通过（`log`/`config`/`security`/`window-state`/`menu`/`updater` 共约 40+ 个用例）。

Run: `pnpm test`
Expected: 全仓库测试通过，无回归。

- [ ] **Step 8: 全量验证——lint**

Run: `pnpm lint`
Expected: 无错误。若此时报告的是 `main.cjs` 已删除但基线文件里仍有记录相关的问题，忽略——`.ultracite-baseline.json` 只是历史豁免记录，条目失效不会导致 lint 失败。

- [ ] **Step 9: 全量验证——本机打包（人工验收清单第 6 条）**

Run:
```bash
OPENSTARTER_DESKTOP_APP_URL=https://example.com pnpm package:desktop
```

Expected: 命令成功完成，`apps/desktop/release/` 目录下出现对应当前操作系统的安装包
文件（macOS 上是 `.dmg` 和 `.zip`；不需要在这一步做跨平台打包验证，本机平台能出包
即视为这一步通过）。

若失败，常见原因排查：
- `Cannot find module 'dist/main.cjs'`：先跑一次 `pnpm build:desktop`。
- 图标相关报错：确认 `apps/desktop/build-resources/icon.png` 确实是 1024×1024 的
  有效 PNG（Task 10 Step 1 已生成）。
- `pnpm approve-builds` 相关提示：根 `package.json` 的 `pnpm.onlyBuiltDependencies`
  已包含 `electron`，通常不需要额外操作；如果 pnpm 仍拦截构建脚本，运行
  `pnpm approve-builds` 手动批准一次。

- [ ] **Step 10: 人工执行 README 里的验收清单第 1-5、7 条**

按 `apps/desktop/README.md` 的"人工验收清单"逐条手动验证（第 6 条已在 Step 9 完成）。
记录结果，若某一条失败，回到对应任务定位问题（第 1/2/4 条对应 Task 8 的
`window.ts`；第 3 条对应 Task 6 的 `menu.ts`；第 5 条对应 Task 8 的兜底页逻辑；
第 7 条对应 Task 5 的 `window-state.ts`）。

- [ ] **Step 11: 最终 commit（若 Step 9-10 发现并修复了问题）**

```bash
git status --short
# 若有未提交的修复，按问题归属的模块单独提交，不要把多个不相关修复堆进一个 commit。
```

---

## 完成后的状态核对

对照 spec `docs/superpowers/specs/2026-08-01-desktop-app-design.md` §12 的完整改动清单：

- [x] 新增：`electron-builder.yml`、`vitest.config.ts`、`README.md`、`.env.example`、`scripts/build.mjs`、`resources/offline.html`、`build-resources/icon.png`
- [x] 新增：`src/{main,preload,config,security,window,window-state,updater,menu,log}.ts`
- [x] 新增：`src/{log,config,security,window-state,menu,updater}.test.ts`（6 个测试文件，比 spec §12 列出的 5 个多一个——`log.ts` 在 spec §5 的表格里原本标注"无（一行封装）"不需要测试，但写 Task 2 时发现前缀拼接、stdout/stderr 分流、`Error` 对象的 stack 提取这几点值得断言，遂补了 3 个测试用例，详见 Task 2）
- [x] 删除：`src/main.cjs`
- [x] 改动：`package.json`（desktop）、`tsconfig.json`（desktop）、`.gitignore`（desktop）
- [x] 改动：根 `vitest.config.ts`、根 `package.json`、根 `README.md`
- [x] 不改：根 `turbo.json`（已在 Global Constraints 和 Task 9 说明中确认原因）
- [x] 保留并修改：`scripts/run-desktop.mjs`（Task 9 Step 6，先 build 再 spawn electron）
