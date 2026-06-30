# Phase 0 · SaaS 启动模板外壳 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 openstarter 的空白 web 应用打磨成一个开箱即用、可直接换皮的 Indie SaaS 启动模板外壳（Landing + 三 shell 路由 + 主题切换 + 404/Error + 换皮文档）。

**Architecture:** 在现有 TanStack Start 应用内，用三个 pathless layout 路由组（`_marketing` / `_auth-pages` / `_app`）隔离营销页、登录页、应用后台三种外观；所有品牌/营销/FAQ 内容收敛到 3 个常量文件；主题用 next-themes + 一段 `<head>` 预水合脚本防 FOUC。后端包（api/auth/db）不动。

**Tech Stack:** TanStack Start（SSR）+ TanStack Router + Hono RPC（不动）+ Better-Auth（不动）+ Drizzle（不动）+ Tailwind v4 + Base UI/shadcn（`packages/ui`）+ next-themes + lucide-react。

**对应设计文档：** `docs/superpowers/specs/2026-06-29-phase-0-saas-starter-shell-design.md`

## Global Constraints

每个任务都隐含遵守以下全局约束（值逐条照抄自 spec / 代码现状）：

- **包管理器固定**：`pnpm@10.25.0`，命令一律用 `pnpm`。运行时为 Node，平台无关。
- **不改后端契约**：不修改 `packages/api`、`packages/auth`、`packages/db` 的对外导出（`app`、`AppType`、`createAuth`、`createDb`、schema）。后端 `/api/health`、`/api/private-data`、`/api/auth/*` 端点保留。
- **品牌单一来源**：所有可见显示名经由 `apps/web/src/lib/branding.ts` 的 `BRAND_NAME` 渲染；`apps/web/src/` 内不出现 `openstarter` 字面量（`@openstarter/*` 的 import 路径除外）。
- **Pricing CTA**：Phase 0 全部指向 `/login`，源码内带 `// TODO(phase-3): wire CTA to Stripe checkout` 注释，不接 Stripe。
- **主题**：next-themes，`attribute="class"`、`defaultTheme="system"`、`enableSystem`、`disableTransitionOnChange`；组件一律用语义 token（`bg-background`/`text-foreground`/`bg-card`/`bg-accent`/`text-primary`/`text-muted-foreground`/`border` 等），不写死颜色（唯一例外：移动抽屉遮罩用 `bg-black/50` 半透明 scrim）。
- **lucide-react 版本**：通过 catalog 统一为 `^0.546.0`（见 Task 1）。
- **Biome / ultracite 规则**（关键项）：类型用 `import type`；禁止 `any`；数组统一写 `T[]`；`<button>` 必带 `type`；`target="_blank"` 必带 `rel="noopener"`；列表 `key` 用稳定值而非数组下标；箭头函数优先（React 组件用函数声明，与现有代码一致）；不留未使用的导入/变量（`noUnusedLocals`/`noUnusedParameters` 已开）。
- **路由 id 约定**（与现有 `_auth/` 一致）：pathless 组 `_x/route.tsx` → `createFileRoute("/_x")`；子路由 `_x/foo.tsx` → `createFileRoute("/_x/foo")`；组内首页 `_x/index.tsx` → `createFileRoute("/_x/")`。

## Verification Strategy（重要：本计划如何"测"）

本仓库 **未配置单元测试 runner**（无 vitest/jest，无 `test` 脚本），且本期是 UI 脚手架，spec 的验收以"类型检查 + 构建 + 人工/烟雾验证"为准。按项目约束（不主动新增测试框架），各任务的验证门为：

- **类型门**：`pnpm -F web check-types`（即 `tsc --noEmit`）。**注意**：`apps/web/src/routeTree.gen.ts` 是 **git 忽略** 的自动生成文件，由 `vite build`/`vite dev` 重新生成。**凡是新增/移动/删除路由文件的任务，必须先 `pnpm -F web build` 重新生成路由树，再跑 `check-types`**，否则类型检查会对着旧路由树报错或漏报。
- **构建门**：`pnpm -F web build`（非常驻，跑完即退出；产物在 `dist/`，并重写 `src/routeTree.gen.ts`）。
- **烟雾门**（仅最终任务）：后台起 `pnpm dev`，用 `curl` 抓 SSR 营销路由的 HTML 断言关键文案；App/登录页因 `ssr:false` 需浏览器人工核验。

> 不新增测试 runner、不写 UI 单元测试，是有意的范围控制（spec 未要求、无 runner、组件以展示为主）。若未来需要测试，另开任务。

每个任务结尾 **必须** `git add <具体文件>` 后 `git commit`（禁止 `git add -A`/`.`，避免带入 `.env`、`local.db` 等）。

---

## File Structure（决策锁定）

```
apps/web/src/
├── routes/
│   ├── __root.tsx                      # 改：去除 Header，接入 ThemeProvider + FOUC 脚本 + title 读 BRAND_NAME
│   ├── _marketing/                     # 新：营销 shell（SSR）
│   │   ├── route.tsx                   #   Header + Outlet + Footer
│   │   ├── index.tsx                   #   "/" Landing（组合 Hero/Features/Pricing/FAQ）
│   │   ├── pricing.tsx                 #   "/pricing"
│   │   ├── privacy.tsx                 #   "/privacy" 占位
│   │   └── terms.tsx                   #   "/terms" 占位
│   ├── _auth-pages/                    # 新：登录类 shell（ssr:false，居中卡片 + 反向守卫）
│   │   ├── route.tsx
│   │   └── login.tsx                   #   "/login"（由 routes/login.tsx 迁入）
│   ├── _app/                           # 新：应用 shell（ssr:false，Sidebar + 守卫）取代 _auth/
│   │   ├── route.tsx
│   │   ├── dashboard.tsx               #   "/dashboard"
│   │   └── settings.tsx                #   "/settings" stub
│   └── api/$.ts                        # 不动
├── components/
│   ├── theme/{theme-provider,theme-toggle-icon,theme-menu-items}.tsx   # 新
│   ├── system/{not-found,error}.tsx                                    # 新
│   ├── marketing/{header,footer,hero,features,pricing-section,faq}.tsx # 新
│   ├── app/{sidebar,sidebar-nav,user-menu,mobile-topbar}.tsx           # 新
│   ├── auth/{sign-in-form,sign-up-form}.tsx                            # 移自 components/
│   └── loader.tsx                      # 不动
├── lib/
│   ├── branding.ts                     # 新：品牌单一来源
│   └── marketing/{pricing,faq}.ts      # 新：定价 / FAQ 数据
└── router.tsx                          # 改：挂 defaultNotFoundComponent / defaultErrorComponent

# 删除（Task 7）：components/header.tsx、components/user-menu.tsx
# 根目录：README.md（重写，Task 8）、CUSTOMIZE.md（新增，Task 9）
```

**任务顺序与依赖：** 1→2→3 打基础；4（营销）/5（登录）/6（应用）为三块功能，建在基础之上；7 清理；8/9 文档；10 总验收。营销/应用任务把"路由 + 组件"放在同一任务内一次性建好，避免跨任务的路由前向引用导致类型报错。

---

## Task 1: 基础设施 — 统一 lucide 版本 + 品牌/定价/FAQ 常量

**Files:**
- Modify: `pnpm-workspace.yaml`（catalog 增 `lucide-react`）
- Modify: `apps/web/package.json`（`lucide-react` → `catalog:`）
- Modify: `packages/ui/package.json`（`lucide-react` → `catalog:`）
- Create: `apps/web/src/lib/branding.ts`
- Create: `apps/web/src/lib/marketing/pricing.ts`
- Create: `apps/web/src/lib/marketing/faq.ts`

**Interfaces:**
- Produces:
  - `branding.ts`：`BRAND_NAME: string`、`BRAND_TAGLINE: string`、`BRAND_DESCRIPTION: string`、`SOCIAL_LINKS: { github: string; x: string; discord: string }`、`COPYRIGHT_YEAR_START: number`
  - `pricing.ts`：`type PricingTier`、`PRICING_TIERS: PricingTier[]`
  - `faq.ts`：`type FaqEntry`、`FAQ_ENTRIES: FaqEntry[]`

- [x] **Step 1: 把 lucide-react 加入 catalog**

编辑 `pnpm-workspace.yaml`，在 `catalog:` 块末尾追加一行（与现有缩进一致）：

```yaml
  lucide-react: ^0.546.0
```

- [x] **Step 2: 让两个包引用 catalog**

`apps/web/package.json` 中：

```json
    "lucide-react": "catalog:",
```

（替换原 `"lucide-react": "^1.8.0",`）

`packages/ui/package.json` 中：

```json
    "lucide-react": "catalog:",
```

（替换原 `"lucide-react": "^0.546.0",`）

- [x] **Step 3: 安装并确认单一版本**

Run: `pnpm install`
然后 Run: `pnpm why lucide-react -r`
Expected: 仅解析出 `lucide-react 0.546.0`（`apps/web` 与 `@openstarter/ui` 都指向它），无 `1.x`。

- [x] **Step 4: 写 `branding.ts`**

Create `apps/web/src/lib/branding.ts`:

```ts
// Single source of truth for brand identity.
// TODO: replace these values with your own brand.
export const BRAND_NAME = "Acme";

export const BRAND_TAGLINE = "Ship your SaaS in days, not months.";

export const BRAND_DESCRIPTION =
  "A production-ready full-stack starter with auth, billing, and a polished UI.";

export const SOCIAL_LINKS = {
  github: "https://github.com/your-org/your-repo",
  x: "https://x.com/your-handle",
  discord: "https://discord.gg/your-invite",
} as const;

export const COPYRIGHT_YEAR_START = 2026;
```

- [x] **Step 5: 写 `marketing/pricing.ts`**

Create `apps/web/src/lib/marketing/pricing.ts`:

```ts
import { Building2, Rocket, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PricingTier = {
  id: "starter" | "pro" | "enterprise";
  name: string;
  icon: LucideIcon;
  priceMonthly: number | "custom";
  description: string;
  features: string[];
  // Phase 0: all CTAs go to /login. Phase 3 will broaden this to Stripe.
  cta: { label: string; to: "/login" };
  highlight?: boolean;
};

// TODO: replace with your own pricing.
export const PRICING_TIERS: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    icon: Rocket,
    priceMonthly: 0,
    description: "For solo builders shipping their first product.",
    features: ["1 project", "Up to 1K MAU", "Community support"],
    cta: { label: "Get started", to: "/login" },
  },
  {
    id: "pro",
    name: "Pro",
    icon: Sparkles,
    priceMonthly: 29,
    description: "Everything you need to grow a real business.",
    features: [
      "Unlimited projects",
      "Up to 50K MAU",
      "Email support",
      "Custom domains",
    ],
    cta: { label: "Start free trial", to: "/login" },
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: Building2,
    priceMonthly: "custom",
    description: "Scale-grade controls and dedicated support.",
    features: ["Unlimited MAU", "SSO / SAML", "Dedicated CSM", "SLA & DPA"],
    cta: { label: "Contact sales", to: "/login" },
  },
];
```

- [x] **Step 6: 写 `marketing/faq.ts`**

Create `apps/web/src/lib/marketing/faq.ts`:

```ts
export type FaqEntry = {
  question: string;
  answer: string;
};

// TODO: replace with your own FAQ entries.
export const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: "Is there a free trial?",
    answer: "Yes — the Starter tier is free forever, no card required.",
  },
  {
    question: "Which payment methods do you accept?",
    answer: "All major credit cards, billed securely through Stripe.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes. You can downgrade or cancel from your account settings.",
  },
  {
    question: "Where is my data stored?",
    answer: "Your data lives in the database connection you configure.",
  },
  {
    question: "Do you offer refunds?",
    answer: "We offer prorated refunds within the first 14 days.",
  },
  {
    question: "How do I get support?",
    answer: "Email our team or open an issue on the project repository.",
  },
];
```

- [x] **Step 7: 类型检查**

Run: `pnpm -F web check-types`
Expected: PASS（无错误）。三个常量文件暂未被引用，但会随 `**/*.ts` 一并被 tsc 校验。

- [x] **Step 8: 提交**

```bash
git add pnpm-workspace.yaml apps/web/package.json packages/ui/package.json pnpm-lock.yaml apps/web/src/lib/branding.ts apps/web/src/lib/marketing/pricing.ts apps/web/src/lib/marketing/faq.ts
git commit -m "feat(web): add brand/pricing/faq constants and pin lucide-react via catalog"
```

---

## Task 2: 主题基础设施 + 根布局重构

**Files:**
- Create: `apps/web/src/components/theme/theme-provider.tsx`
- Create: `apps/web/src/components/theme/theme-toggle-icon.tsx`
- Create: `apps/web/src/components/theme/theme-menu-items.tsx`
- Modify: `apps/web/src/routes/__root.tsx`

**Interfaces:**
- Consumes: `BRAND_NAME`、`BRAND_DESCRIPTION`（Task 1）
- Produces:
  - `ThemeProvider({ children }: { children: ReactNode })`
  - `ThemeToggleIcon()` — 单图标按钮，light↔dark
  - `ThemeMenuItems()` — 一组 DropdownMenu 单选项（System/Light/Dark）

- [x] **Step 1: 写 `theme-provider.tsx`**

Create `apps/web/src/components/theme/theme-provider.tsx`:

```tsx
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [x] **Step 2: 写 `theme-toggle-icon.tsx`**

Create `apps/web/src/components/theme/theme-toggle-icon.tsx`:

```tsx
import { Button } from "@openstarter/ui/components/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggleIcon() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
```

> `mounted` 守卫避免 SSR/CSR 图标不一致的水合告警；未挂载前固定显示 Moon。

- [x] **Step 3: 写 `theme-menu-items.tsx`**

Create `apps/web/src/components/theme/theme-menu-items.tsx`:

```tsx
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@openstarter/ui/components/dropdown-menu";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenuRadioGroup
      value={mounted ? theme : undefined}
      onValueChange={(value) => setTheme(String(value))}
    >
      <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}
```

- [x] **Step 4: 重构 `__root.tsx`**

把 `apps/web/src/routes/__root.tsx` 整体替换为：

```tsx
import { Toaster } from "@openstarter/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/branding";

import appCss from "../index.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
}

// Runs before hydration to set the theme class and avoid a flash of the wrong theme.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||((t==='system'||!t)&&m);var c=document.documentElement.classList;c.toggle('dark',d);c.toggle('light',!d);}catch(e){}})();`;

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: BRAND_NAME },
      { name: "description", content: BRAND_DESCRIPTION },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: required pre-hydration theme script to prevent FOUC */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <Outlet />
          <Toaster richColors />
        </ThemeProvider>
        <TanStackRouterDevtools position="bottom-left" />
        <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
```

> 变化要点：移除 `<Header />` 与外层 `grid h-svh`（布局交给各 shell 自己负责）；删去硬编码 `className="dark"`，改 `suppressHydrationWarning` + 主题脚本；`<title>` 改读 `BRAND_NAME`，新增 description meta。此时 `components/header.tsx` 变为未被引用（Task 7 删除）。

- [x] **Step 5: 类型检查**

Run: `pnpm -F web check-types`
Expected: PASS。

- [x] **Step 6: 提交**

```bash
git add apps/web/src/components/theme/theme-provider.tsx apps/web/src/components/theme/theme-toggle-icon.tsx apps/web/src/components/theme/theme-menu-items.tsx apps/web/src/routes/__root.tsx
git commit -m "feat(web): add theme provider/toggle and wire FOUC-safe theming into root"
```

---

## Task 3: 系统页（404 / Error）+ router 接线

**Files:**
- Create: `apps/web/src/components/system/not-found.tsx`
- Create: `apps/web/src/components/system/error.tsx`
- Modify: `apps/web/src/router.tsx`

**Interfaces:**
- Consumes: `BRAND_NAME`（Task 1）
- Produces: `NotFound()`、`ErrorPage({ error }: { error: Error })`

- [x] **Step 1: 写 `system/not-found.tsx`**

Create `apps/web/src/components/system/not-found.tsx`:

```tsx
import { Button } from "@openstarter/ui/components/button";
import { Link } from "@tanstack/react-router";

import { BRAND_NAME } from "@/lib/branding";

export function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="font-semibold text-lg">{BRAND_NAME}</span>
      <h1 className="font-bold text-2xl">404 — page not found</h1>
      <p className="text-muted-foreground text-sm">
        The page you are looking for does not exist or was moved.
      </p>
      <Button render={<Link to="/" />}>Back home</Button>
    </main>
  );
}
```

- [x] **Step 2: 写 `system/error.tsx`**

Create `apps/web/src/components/system/error.tsx`:

```tsx
import { Button } from "@openstarter/ui/components/button";

import { BRAND_NAME } from "@/lib/branding";

export function ErrorPage({ error }: { error: Error }) {
  const isDev = import.meta.env.DEV;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="font-semibold text-lg">{BRAND_NAME}</span>
      <h1 className="font-bold text-2xl">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        An unexpected error occurred. Please try again.
      </p>
      {isDev ? (
        <pre className="max-w-full overflow-x-auto rounded bg-muted p-3 text-left text-xs">
          {error.message}
        </pre>
      ) : null}
      <Button type="button" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </main>
  );
}
```

- [x] **Step 3: 在 `router.tsx` 挂载**

在 `apps/web/src/router.tsx` 顶部 import 区加入：

```tsx
import { ErrorPage } from "./components/system/error";
import { NotFound } from "./components/system/not-found";
```

把 `createTanStackRouter({ ... })` 里这一行：

```tsx
    defaultNotFoundComponent: () => <div>Not Found</div>,
```

替换为：

```tsx
    defaultNotFoundComponent: () => <NotFound />,
    defaultErrorComponent: ({ error }) => <ErrorPage error={error} />,
```

（保留同块内既有的 `defaultPendingComponent: () => <Loader />`。）

- [x] **Step 4: 类型检查**

Run: `pnpm -F web check-types`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add apps/web/src/components/system/not-found.tsx apps/web/src/components/system/error.tsx apps/web/src/router.tsx
git commit -m "feat(web): add shell-free 404 and error pages"
```

---

## Task 4: 营销站（_marketing shell + Header/Footer + Landing 段落 + /pricing + 法务页）

> 一次性建好"路由 + 组件"，避免跨任务的路由前向引用（Header/Hero 链接到 `/pricing`，须与 `/pricing` 路由同任务存在）。

**Files:**
- Create: `apps/web/src/components/marketing/header.tsx`
- Create: `apps/web/src/components/marketing/footer.tsx`
- Create: `apps/web/src/components/marketing/hero.tsx`
- Create: `apps/web/src/components/marketing/features.tsx`
- Create: `apps/web/src/components/marketing/pricing-section.tsx`
- Create: `apps/web/src/components/marketing/faq.tsx`
- Create: `apps/web/src/routes/_marketing/route.tsx`
- Create: `apps/web/src/routes/_marketing/index.tsx`
- Create: `apps/web/src/routes/_marketing/pricing.tsx`
- Create: `apps/web/src/routes/_marketing/privacy.tsx`
- Create: `apps/web/src/routes/_marketing/terms.tsx`
- Delete: `apps/web/src/routes/index.tsx`

**Interfaces:**
- Consumes: `BRAND_NAME`/`BRAND_TAGLINE`/`SOCIAL_LINKS`/`COPYRIGHT_YEAR_START`、`PRICING_TIERS`、`FAQ_ENTRIES`（Task 1）；`ThemeToggleIcon`（Task 2）；`authClient`（现有 `@/lib/auth-client`）
- Produces: `MarketingHeader()`、`MarketingFooter()`、`Hero()`、`Features()`、`PricingSection()`、`Faq()`；路由 `/`、`/pricing`、`/privacy`、`/terms`

- [x] **Step 1: 写 `marketing/header.tsx`**

Create `apps/web/src/components/marketing/header.tsx`:

```tsx
import { Button } from "@openstarter/ui/components/button";
import { Skeleton } from "@openstarter/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ThemeToggleIcon } from "@/components/theme/theme-toggle-icon";
import { authClient } from "@/lib/auth-client";
import { BRAND_NAME } from "@/lib/branding";

const NAV_LINKS = [
  { label: "Features", to: "/", hash: "features" },
  { label: "Pricing", to: "/pricing", hash: undefined },
  { label: "FAQ", to: "/", hash: "faq" },
] as const;

function AuthCta() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-8 w-32" />;
  }
  if (session) {
    return <Button render={<Link to="/dashboard" />}>Go to dashboard</Button>;
  }
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" render={<Link to="/login" />}>
        Sign in
      </Button>
      <Button render={<Link to="/login" />}>Sign up</Button>
    </div>
  );
}

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="font-semibold">
          {BRAND_NAME}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              hash={link.hash}
              className="text-muted-foreground text-sm hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggleIcon />
          <AuthCta />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggleIcon />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu />
          </Button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-0 right-0 flex h-full w-72 flex-col gap-4 bg-background p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{BRAND_NAME}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </div>
            <nav className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  hash={link.hash}
                  onClick={() => setOpen(false)}
                  className="text-sm"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <AuthCta />
          </div>
        </div>
      ) : null}
    </header>
  );
}
```

- [x] **Step 2: 写 `marketing/footer.tsx`**

Create `apps/web/src/components/marketing/footer.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { Github, MessageCircle, Twitter } from "lucide-react";

import {
  BRAND_NAME,
  BRAND_TAGLINE,
  COPYRIGHT_YEAR_START,
  SOCIAL_LINKS,
} from "@/lib/branding";

const PRODUCT_LINKS = [
  { label: "Features", to: "/", hash: "features" },
  { label: "Pricing", to: "/pricing", hash: undefined },
  { label: "FAQ", to: "/", hash: "faq" },
] as const;

const LEGAL_LINKS = [
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
] as const;

function copyrightLabel(): string {
  const now = new Date().getFullYear();
  return now > COPYRIGHT_YEAR_START ? `${COPYRIGHT_YEAR_START}-${now}` : `${now}`;
}

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <span className="font-semibold">{BRAND_NAME}</span>
          <p className="text-muted-foreground text-sm">{BRAND_TAGLINE}</p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-medium text-sm">Product</span>
          {PRODUCT_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              hash={link.hash}
              className="text-muted-foreground text-sm hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-medium text-sm">Legal</span>
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="text-muted-foreground text-sm hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-medium text-sm">Connect</span>
          <div className="flex gap-3">
            <a
              href={SOCIAL_LINKS.github}
              aria-label="GitHub"
              target="_blank"
              rel="noopener"
              className="text-muted-foreground hover:text-foreground"
            >
              <Github aria-hidden="true" className="size-5" />
            </a>
            <a
              href={SOCIAL_LINKS.x}
              aria-label="X"
              target="_blank"
              rel="noopener"
              className="text-muted-foreground hover:text-foreground"
            >
              <Twitter aria-hidden="true" className="size-5" />
            </a>
            <a
              href={SOCIAL_LINKS.discord}
              aria-label="Discord"
              target="_blank"
              rel="noopener"
              className="text-muted-foreground hover:text-foreground"
            >
              <MessageCircle aria-hidden="true" className="size-5" />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t py-6 text-center text-muted-foreground text-xs">
        (c) {copyrightLabel()} {BRAND_NAME}
      </div>
    </footer>
  );
}
```

- [x] **Step 3: 写 `marketing/hero.tsx`**

Create `apps/web/src/components/marketing/hero.tsx`:

```tsx
import { Button } from "@openstarter/ui/components/button";
import { Link } from "@tanstack/react-router";

import { BRAND_TAGLINE } from "@/lib/branding";

// TODO: replace with your product copy.
const COPY = {
  title: BRAND_TAGLINE,
  subtitle:
    "A full-stack TypeScript starter with auth, billing seams, and a polished UI - so you can focus on what makes your product unique.",
  primaryCta: "Start free trial",
  secondaryCta: "View pricing",
} as const;

export function Hero() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center">
      <h1 className="font-bold text-4xl tracking-tight sm:text-5xl">
        {COPY.title}
      </h1>
      <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
        {COPY.subtitle}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" render={<Link to="/login" />}>
          {COPY.primaryCta}
        </Button>
        <Button size="lg" variant="outline" render={<Link to="/pricing" />}>
          {COPY.secondaryCta}
        </Button>
      </div>
      <div className="mt-8 w-full rounded-xl border bg-gradient-to-b from-muted/50 to-muted/10 p-2 shadow-sm">
        <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-card text-muted-foreground text-sm">
          Your product preview goes here
        </div>
      </div>
    </section>
  );
}
```

- [x] **Step 4: 写 `marketing/features.tsx`**

Create `apps/web/src/components/marketing/features.tsx`:

```tsx
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui/components/card";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

// TODO: replace with your product features.
const FEATURES: Feature[] = [
  {
    icon: Zap,
    title: "Type-safe end to end",
    description:
      "From database to UI with Drizzle, Hono RPC, and TanStack - no codegen drift.",
  },
  {
    icon: ShieldCheck,
    title: "Auth out of the box",
    description:
      "Email and password sessions wired with Better-Auth, ready for OAuth.",
  },
  {
    icon: Sparkles,
    title: "Stripe-ready",
    description:
      "A pricing page and billing seams designed to plug into Stripe fast.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20">
      <div className="mb-12 text-center">
        <h2 className="font-bold text-3xl tracking-tight">
          Everything you need to ship
        </h2>
        <p className="mt-2 text-muted-foreground">
          Batteries included, opinions optional.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title}>
              <CardHeader>
                <Icon aria-hidden="true" className="mb-2 size-6 text-primary" />
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
```

- [x] **Step 5: 写 `marketing/pricing-section.tsx`**

Create `apps/web/src/components/marketing/pricing-section.tsx`:

```tsx
import { Button } from "@openstarter/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@openstarter/ui/components/card";
import { cn } from "@openstarter/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { PRICING_TIERS } from "@/lib/marketing/pricing";

function formatPrice(price: number | "custom"): string {
  if (price === "custom") {
    return "Custom";
  }
  if (price === 0) {
    return "Free";
  }
  return `$${price}/mo`;
}

export function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20">
      <div className="mb-12 text-center">
        <h2 className="font-bold text-3xl tracking-tight">
          Simple, transparent pricing
        </h2>
        <p className="mt-2 text-muted-foreground">
          Start free. Upgrade when you grow.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {PRICING_TIERS.map((tier) => {
          const Icon = tier.icon;
          return (
            <Card
              key={tier.id}
              className={cn(tier.highlight && "ring-2 ring-primary")}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Icon aria-hidden="true" className="size-5 text-primary" />
                  {tier.highlight ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs">
                      Most popular
                    </span>
                  ) : null}
                </div>
                <CardTitle className="mt-2 text-lg">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="mt-2 font-bold text-2xl">
                  {formatPrice(tier.priceMonthly)}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="flex flex-col gap-2">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check aria-hidden="true" className="size-4 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              {/* TODO(phase-3): wire CTA to Stripe checkout */}
              <CardFooter>
                <Button
                  className="w-full"
                  variant={tier.highlight ? "default" : "outline"}
                  render={<Link to={tier.cta.to} />}
                >
                  {tier.cta.label}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
```

- [x] **Step 6: 写 `marketing/faq.tsx`（原生 details 互斥手风琴）**

Create `apps/web/src/components/marketing/faq.tsx`:

```tsx
import { ChevronDown } from "lucide-react";

import { FAQ_ENTRIES } from "@/lib/marketing/faq";

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
      <div className="mb-12 text-center">
        <h2 className="font-bold text-3xl tracking-tight">
          Frequently asked questions
        </h2>
      </div>
      <div className="flex flex-col gap-3">
        {FAQ_ENTRIES.map((entry) => (
          <details
            key={entry.question}
            name="faq"
            className="group rounded-lg border bg-card px-4 py-3"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
              {entry.question}
              <ChevronDown
                aria-hidden="true"
                className="size-4 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-2 text-muted-foreground text-sm">{entry.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
```

> `name="faq"` 是原生互斥手风琴（同名 `<details>` 一次只开一个），无需 JS、无障碍由浏览器保证。

- [x] **Step 7: 写 `_marketing/route.tsx`（布局）**

Create `apps/web/src/routes/_marketing/route.tsx`:

```tsx
import { Outlet, createFileRoute } from "@tanstack/react-router";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";

export const Route = createFileRoute("/_marketing")({
  component: MarketingLayout,
});

function MarketingLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}
```

- [x] **Step 8: 写 `_marketing/index.tsx`（Landing 组合）**

Create `apps/web/src/routes/_marketing/index.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";

import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { PricingSection } from "@/components/marketing/pricing-section";

export const Route = createFileRoute("/_marketing/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <PricingSection />
      <Faq />
    </>
  );
}
```

- [x] **Step 9: 写 `_marketing/pricing.tsx`**

Create `apps/web/src/routes/_marketing/pricing.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";

import { PricingSection } from "@/components/marketing/pricing-section";

export const Route = createFileRoute("/_marketing/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 text-center">
      <h1 className="font-bold text-4xl tracking-tight">Pricing</h1>
      <p className="mt-3 text-muted-foreground">
        Choose the plan that fits where you are today.
      </p>
      <PricingSection />
    </div>
  );
}
```

> Phase 0：`/pricing` 复用 `<PricingSection>`。Phase 3 再扩充特性对比表。

- [x] **Step 10: 写 `_marketing/privacy.tsx` 与 `_marketing/terms.tsx`**

Create `apps/web/src/routes/_marketing/privacy.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="font-bold text-3xl tracking-tight">Privacy Policy</h1>
      {/* TODO: replace with your own privacy policy. */}
      <p className="mt-4 text-muted-foreground">
        This is placeholder content. Replace it with your product privacy
        policy before launch.
      </p>
    </div>
  );
}
```

Create `apps/web/src/routes/_marketing/terms.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="font-bold text-3xl tracking-tight">Terms of Service</h1>
      {/* TODO: replace with your own terms of service. */}
      <p className="mt-4 text-muted-foreground">
        This is placeholder content. Replace it with your product terms of
        service before launch.
      </p>
    </div>
  );
}
```

- [x] **Step 11: 删除旧首页**

Delete `apps/web/src/routes/index.tsx`（其内容已被 `_marketing/index.tsx` 取代；`/` 现由营销 shell 提供）。

- [x] **Step 12: 重新生成路由树并类型检查**

Run: `pnpm -F web build`
Expected: 构建成功；`apps/web/src/routeTree.gen.ts` 被重写，含 `/_marketing`、`/_marketing/`、`/_marketing/pricing`、`/_marketing/privacy`、`/_marketing/terms`。
Run: `pnpm -F web check-types`
Expected: PASS。

- [x] **Step 13: 提交**

```bash
git add apps/web/src/components/marketing apps/web/src/routes/_marketing
git rm apps/web/src/routes/index.tsx
git commit -m "feat(web): build marketing shell with landing, pricing, and legal pages"
```

---

## Task 5: 登录类页面 shell（_auth-pages）+ 迁移表单与 login

**Files:**
- Move: `apps/web/src/components/sign-in-form.tsx` → `apps/web/src/components/auth/sign-in-form.tsx`
- Move: `apps/web/src/components/sign-up-form.tsx` → `apps/web/src/components/auth/sign-up-form.tsx`
- Create: `apps/web/src/routes/_auth-pages/route.tsx`
- Create: `apps/web/src/routes/_auth-pages/login.tsx`
- Delete: `apps/web/src/routes/login.tsx`

**Interfaces:**
- Consumes: `authClient`、`BRAND_NAME`
- Produces: 路由 `/login`（居中卡片 shell，已登录自动跳 `/dashboard`）

> 表单内部逻辑本期不重写（Phase 1 才做），仅移动位置并修正相对 import（`./loader` → `../loader`）。

- [x] **Step 1: 移动两个表单文件**

用支持自动改 import 的方式移动（或手动移动后修正引用）：
- `apps/web/src/components/sign-in-form.tsx` → `apps/web/src/components/auth/sign-in-form.tsx`
- `apps/web/src/components/sign-up-form.tsx` → `apps/web/src/components/auth/sign-up-form.tsx`

移动后，确认两文件内的 `import Loader from "./loader";` 改为 `import Loader from "../loader";`（`loader.tsx` 仍在 `components/` 根下）。其余 import（`@openstarter/ui/*`、`@/lib/auth-client`、`sonner`、`zod` 等）不变。

- [x] **Step 2: 写 `_auth-pages/route.tsx`（居中布局 + 反向守卫）**

Create `apps/web/src/routes/_auth-pages/route.tsx`:

```tsx
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { BRAND_NAME } from "@/lib/branding";

export const Route = createFileRoute("/_auth-pages")({
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (session.data) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPagesLayout,
});

function AuthPagesLayout() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 px-4">
      <span className="font-semibold text-lg">{BRAND_NAME}</span>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
```

> `ssr: false` 让 `beforeLoad` 仅在客户端执行，`authClient.getSession()` 能带上浏览器 cookie，已登录用户访问 `/login` 即被跳转到 `/dashboard`。

- [x] **Step 3: 写 `_auth-pages/login.tsx`（迁移自 routes/login.tsx）**

Create `apps/web/src/routes/_auth-pages/login.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import SignInForm from "@/components/auth/sign-in-form";
import SignUpForm from "@/components/auth/sign-up-form";

export const Route = createFileRoute("/_auth-pages/login")({
  component: LoginPage,
});

function LoginPage() {
  const [showSignIn, setShowSignIn] = useState(false);

  return showSignIn ? (
    <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
  ) : (
    <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
  );
}
```

- [x] **Step 4: 删除旧 login 路由**

Delete `apps/web/src/routes/login.tsx`（URL `/login` 不变，现由 `_auth-pages` 提供）。

- [x] **Step 5: 重新生成路由树并类型检查**

Run: `pnpm -F web build`
Expected: 成功；路由树含 `/_auth-pages`、`/_auth-pages/login`，URL 仍为 `/login`。
Run: `pnpm -F web check-types`
Expected: PASS。

- [x] **Step 6: 提交**

```bash
git add apps/web/src/components/auth apps/web/src/routes/_auth-pages
git rm apps/web/src/components/sign-in-form.tsx apps/web/src/components/sign-up-form.tsx apps/web/src/routes/login.tsx
git commit -m "feat(web): add centered auth-pages shell and relocate auth forms"
```

---

## Task 6: 应用 shell（_app）— Sidebar/UserMenu/移动抽屉 + dashboard/settings，替换 _auth

> 路由与组件同任务建好（Sidebar nav 链接到 `/dashboard`、`/settings`，须与这两个路由同时存在）。完成后删除旧 `_auth/`。

**Files:**
- Create: `apps/web/src/components/app/sidebar-nav.tsx`
- Create: `apps/web/src/components/app/user-menu.tsx`
- Create: `apps/web/src/components/app/sidebar.tsx`
- Create: `apps/web/src/components/app/mobile-topbar.tsx`
- Create: `apps/web/src/routes/_app/route.tsx`
- Create: `apps/web/src/routes/_app/dashboard.tsx`
- Create: `apps/web/src/routes/_app/settings.tsx`
- Delete: `apps/web/src/routes/_auth/route.tsx`、`apps/web/src/routes/_auth/dashboard.tsx`（即整个 `_auth/` 目录）

**Interfaces:**
- Consumes: `authClient`、`BRAND_NAME`、`ThemeMenuItems`（Task 2）、现有 `dropdown-menu`/`button`/`skeleton`
- Produces: `SidebarNav({ onNavigate? })` + `APP_NAV_ITEMS`、`UserMenu()`、`Sidebar()`、`MobileTopbar()`；路由 `/dashboard`、`/settings`

- [x] **Step 1: 写 `app/sidebar-nav.tsx`**

Create `apps/web/src/components/app/sidebar-nav.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  to: "/dashboard" | "/settings";
  label: string;
  icon: LucideIcon;
};

export const APP_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {APP_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            activeProps={{ className: "bg-accent text-accent-foreground" }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Icon aria-hidden="true" className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [x] **Step 2: 写 `app/user-menu.tsx`（底部卡片 + 向上展开）**

Create `apps/web/src/components/app/user-menu.tsx`:

```tsx
import { Button } from "@openstarter/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstarter/ui/components/dropdown-menu";
import { Skeleton } from "@openstarter/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, User } from "lucide-react";

import { ThemeMenuItems } from "@/components/theme/theme-menu-items";
import { authClient } from "@/lib/auth-client";

export function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-10 w-full" />;
  }
  if (!session) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-2 py-2"
          />
        }
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-muted">
          <User aria-hidden="true" className="size-4" />
        </span>
        <span className="flex min-w-0 flex-col items-start">
          <span className="truncate font-medium text-sm">
            {session.user.name}
          </span>
          <span className="truncate text-muted-foreground text-xs">
            {session.user.email}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56 bg-card">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <ThemeMenuItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/settings" />}>
          <Settings aria-hidden="true" className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  navigate({ to: "/" });
                },
              },
            });
          }}
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [x] **Step 3: 写 `app/sidebar.tsx`（桌面）**

Create `apps/web/src/components/app/sidebar.tsx`:

```tsx
import { Link } from "@tanstack/react-router";

import { SidebarNav } from "@/components/app/sidebar-nav";
import { UserMenu } from "@/components/app/user-menu";
import { BRAND_NAME } from "@/lib/branding";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <Link to="/dashboard" className="font-semibold">
          {BRAND_NAME}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <SidebarNav />
      </div>
      <div className="border-t p-2">
        <UserMenu />
      </div>
    </aside>
  );
}
```

- [x] **Step 4: 写 `app/mobile-topbar.tsx`（移动顶栏 + 抽屉）**

Create `apps/web/src/components/app/mobile-topbar.tsx`:

```tsx
import { Button } from "@openstarter/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { SidebarNav } from "@/components/app/sidebar-nav";
import { UserMenu } from "@/components/app/user-menu";
import { BRAND_NAME } from "@/lib/branding";

export function MobileTopbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="md:hidden">
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu />
        </Button>
        <Link to="/dashboard" className="font-semibold">
          {BRAND_NAME}
        </Link>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-0 left-0 flex h-full w-72 flex-col bg-sidebar">
            <div className="flex h-12 items-center justify-between border-b px-3">
              <span className="font-semibold">{BRAND_NAME}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <SidebarNav onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t p-2">
              <UserMenu />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [x] **Step 5: 写 `_app/route.tsx`（守卫 + 布局）**

Create `apps/web/src/routes/_app/route.tsx`:

```tsx
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { MobileTopbar } from "@/components/app/mobile-topbar";
import { Sidebar } from "@/components/app/sidebar";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

> 与旧 `_auth/route.tsx` 等价的守卫（`ssr:false` + `getSession` + 无 session 跳 `/login`），并返回 `{ session }` 供子路由用。

- [x] **Step 6: 写 `_app/dashboard.tsx`**

Create `apps/web/src/routes/_app/dashboard.tsx`:

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui/components/card";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { session } = Route.useRouteContext();
  const name = session.data?.user.name ?? "there";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-bold text-2xl">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {name}.</p>
      </div>
      {/* TODO: replace with your app's main view */}
      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>
            A few pointers to help you make this template your own.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link to="/settings" className="text-primary hover:underline">
                Configure your account settings
              </Link>
            </li>
            <li className="text-muted-foreground">
              Open CUSTOMIZE.md in the project root to rebrand the template.
            </li>
            <li className="text-muted-foreground">
              Check the README for available scripts and deployment.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [x] **Step 7: 写 `_app/settings.tsx`（stub）**

Create `apps/web/src/routes/_app/settings.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="font-bold text-2xl">Settings</h1>
      {/* TODO(phase-1): account settings (profile, security, sessions) */}
      <p className="text-muted-foreground">
        Account settings arrive in Phase 1. See docs/superpowers/specs for the
        roadmap.
      </p>
    </div>
  );
}
```

- [x] **Step 8: 删除旧 `_auth/` 目录**

Delete `apps/web/src/routes/_auth/route.tsx` 和 `apps/web/src/routes/_auth/dashboard.tsx`（URL `/dashboard` 不变，现由 `_app` 提供；新增 `/settings`）。

- [x] **Step 9: 重新生成路由树并类型检查**

Run: `pnpm -F web build`
Expected: 成功；路由树含 `/_app`、`/_app/dashboard`、`/_app/settings`，不再含 `/_auth*`。
Run: `pnpm -F web check-types`
Expected: PASS。

- [x] **Step 10: 提交**

```bash
git add apps/web/src/components/app apps/web/src/routes/_app
git rm apps/web/src/routes/_auth/route.tsx apps/web/src/routes/_auth/dashboard.tsx
git commit -m "feat(web): build app shell with sidebar, user menu, and mobile drawer"
```

---

## Task 7: 清理旧组件 + 残留校验

**Files:**
- Delete: `apps/web/src/components/header.tsx`
- Delete: `apps/web/src/components/user-menu.tsx`

**Interfaces:**
- Consumes: 无
- Produces: 无（仅删除 + 校验）

- [x] **Step 1: 确认旧文件已无人引用**

Run: `grep -rn "components/header\|components/user-menu\|from \"./header\"\|from \"./user-menu\"" apps/web/src`
Expected: 无输出（`__root.tsx` 已不再引入 Header；旧 user-menu 仅被旧 header 引用，均已弃用）。

- [x] **Step 2: 删除旧文件**

Delete `apps/web/src/components/header.tsx` 与 `apps/web/src/components/user-menu.tsx`。

- [x] **Step 3: 品牌字面量残留校验（验收 #10）**

Run: `grep -rn "openstarter" apps/web/src | grep -v "@openstarter/"`
Expected: 无输出（`apps/web/src` 内除 `@openstarter/*` import 路径外，不出现 `openstarter` 字面量；可见显示名全部经 `BRAND_NAME`）。

- [x] **Step 4: 营销占位 TODO 校验（验收 #11）**

Run: `grep -rl "TODO" apps/web/src/components/marketing | wc -l`
Expected: ≥ 5（hero/features/pricing-section/faq 数据源 + pricing CTA 注释等均含 TODO 提示）。

> 注：FAQ 文案在 `lib/marketing/faq.ts`、定价在 `lib/marketing/pricing.ts` 的 TODO 也计入换皮提示；若上面只数 `components/marketing` 不足 5，再 Run `grep -rl "TODO" apps/web/src/components/marketing apps/web/src/lib/marketing` 应 ≥ 5。

- [x] **Step 5: 重新生成路由树并类型检查**

Run: `pnpm -F web build`
Expected: 成功。
Run: `pnpm -F web check-types`
Expected: PASS。

- [x] **Step 6: 提交**

```bash
git rm apps/web/src/components/header.tsx apps/web/src/components/user-menu.tsx
git commit -m "chore(web): remove legacy header and user-menu components"
```

---

## Task 8: 重写 README.md

**Files:**
- Modify: `README.md`（整体重写）

**Interfaces:** 无代码接口。

- [x] **Step 1: 用以下内容整体替换 `README.md`**

````markdown
# openstarter

An opinionated, production-ready starter for shipping an Indie SaaS fast. Clone
it, rebrand it, and start building your product instead of your boilerplate.

**What you get**

- A polished marketing site (hero, features, pricing, FAQ) ready to rebrand.
- Email/password authentication with protected app routes.
- A typed full-stack setup (TanStack Start + Hono RPC) on a single Node server.

## Quick start

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
# Edit apps/web/.env and set a strong BETTER_AUTH_SECRET (see below).
pnpm db:push
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The API is served from the
same origin under `/api/*`.

Generate a secret for `BETTER_AUTH_SECRET`:

```bash
openssl rand -hex 32
```

## What's in the box

| Capability   | Implementation                                  |
| ------------ | ----------------------------------------------- |
| Routing      | TanStack Start + TanStack Router (file-based)   |
| Backend      | Hono app mounted at `/api/*` (Hono RPC client)  |
| Auth         | Better-Auth (email/password sessions)           |
| Database     | Drizzle ORM on SQLite/Turso (libSQL)            |
| UI           | shadcn/Base UI primitives in `packages/ui`      |
| Theming      | next-themes (system/light/dark, no-FOUC)        |
| Styling      | Tailwind CSS v4                                  |
| Monorepo     | Turborepo + pnpm workspaces                     |
| Email        | _planned (Phase 2)_                             |
| Billing      | _planned (Phase 3)_                             |

## Project structure

```
openstarter/
├── apps/
│   └── web/         # Full-stack app (TanStack Start + Hono via server routes)
│       └── src/
│           ├── routes/_marketing/   # public marketing pages
│           ├── routes/_auth-pages/  # login (centered, no chrome)
│           ├── routes/_app/         # authenticated app (sidebar shell)
│           ├── components/          # marketing / app / theme / system / auth
│           └── lib/                 # branding.ts + marketing/{pricing,faq}.ts
├── packages/
│   ├── ui/          # Shared shadcn/Base UI components and styles
│   ├── api/         # Hono app (auth + routes) + AppType for RPC
│   ├── auth/        # Better-Auth configuration
│   └── db/          # Database schema & client
```

## Customizing the template

Make it yours by following the checklist in [CUSTOMIZE.md](./CUSTOMIZE.md):
rename the project, set your brand in `apps/web/src/lib/branding.ts`, edit
pricing/FAQ data, and replace the placeholder marketing copy.

## Available scripts

- `pnpm dev` — start the app in development mode (http://localhost:3000)
- `pnpm build` — build for production
- `pnpm --filter web start` — run the production Node server
- `pnpm check-types` — type-check across the workspace
- `pnpm db:push` / `db:generate` / `db:migrate` / `db:studio` / `db:local` — Drizzle commands

## Deployment

The app builds to a standard Node server (`apps/web/dist/server/server.js`).

1. Build: `pnpm build`
2. Start: `pnpm --filter web start`

Provide these environment variables on your host:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

Deploy anywhere Node runs (Docker, VPS, Vercel, Netlify).

## Roadmap

This starter ships in phases. Phase 0 (this shell) is done; the rest are
planned:

- **Phase 1 — Auth experience:** password reset, email verification, OAuth
  (Google/GitHub), full account settings. _coming soon_
- **Phase 2 — Email:** transactional email via Resend + React Email. _coming soon_
- **Phase 3 — Billing:** Stripe subscriptions, customer portal, plan gating.
  _coming soon_
- **Phase 4 — DX polish:** SEO (sitemap/robots/OG), CONTRIBUTING, docs. _coming soon_
````

- [x] **Step 2: 提交**

```bash
git add README.md
git commit -m "docs: rewrite README as a SaaS starter quick-start guide"
```

---

## Task 9: 新增 CUSTOMIZE.md（换皮 checklist）

**Files:**
- Create: `CUSTOMIZE.md`（根目录）

**Interfaces:** 无代码接口。

- [x] **Step 1: 写 `CUSTOMIZE.md`**

Create `CUSTOMIZE.md`:

````markdown
# Customizing this template

Work through these steps after cloning. Most branding lives in **three files** —
once you've renamed the project, customizing is mostly editing those.

> macOS uses BSD `sed` (`sed -i ''`); Linux uses GNU `sed` (`sed -i`). Commands
> below show the macOS form. On Linux, drop the empty `''` after `-i`.

## 1. Rename your project

Pick a project name and an npm scope (e.g. project `acme`, scope `@acme`).

**Preview** what would change first:

```bash
grep -rl "openstarter" --include="*.json" --include="*.ts" --include="*.tsx" --include="*.yaml" --include="*.md" .
```

Replace the package scope `@openstarter/` everywhere:

```bash
grep -rl "@openstarter/" --include="*.json" --include="*.ts" --include="*.tsx" . \
  | xargs sed -i '' 's/@openstarter\//@acme\//g'
```

Then set the root project name (root `package.json` "name" field) and any
remaining references:

```bash
sed -i '' 's/"name": "openstarter"/"name": "acme"/' package.json
```

Files that reference the scope or name: root `package.json`,
`pnpm-workspace.yaml`, `tsconfig.base.json` paths, every `packages/*/package.json`,
`apps/web/package.json`, `apps/web/tsconfig.json`, and all `@openstarter/*`
imports under `apps/web/src` and `packages/*`.

Reinstall and verify:

```bash
pnpm install
pnpm check-types
```

## 2. Set your display name

Edit `apps/web/src/lib/branding.ts`:

- `BRAND_NAME` — shown in the header, sidebar, footer, page `<title>`, and auth pages
- `BRAND_TAGLINE` — the hero headline and footer tagline
- `BRAND_DESCRIPTION` — the `<meta name="description">`
- `SOCIAL_LINKS` — your GitHub / X / Discord URLs
- `COPYRIGHT_YEAR_START` — the footer copyright start year

## 3. Replace the marketing copy

Find every placeholder:

```bash
grep -rn "TODO: replace" apps/web/src
```

Edit these files:

- `apps/web/src/components/marketing/hero.tsx` — headline, subtitle, CTAs
- `apps/web/src/components/marketing/features.tsx` — the three feature cards
- `apps/web/src/components/marketing/pricing-section.tsx` — layout (data lives below)
- `apps/web/src/components/marketing/faq.tsx` — layout (data lives below)

## 4. Configure pricing

Edit `PRICING_TIERS` in `apps/web/src/lib/marketing/pricing.ts`. Add/remove
tiers, change names, prices, and feature lists. Both the landing page and
`/pricing` read from this one array.

> Phase 3 will swap this static array for tiers synced from Stripe Products.
> CTAs currently link to `/login`.

## 5. Replace the FAQ

Edit `FAQ_ENTRIES` in `apps/web/src/lib/marketing/faq.ts`.

## 6. Regenerate secrets

```bash
openssl rand -hex 32
```

Put the result in `apps/web/.env` as `BETTER_AUTH_SECRET`.

## 7. Reset git history (optional)

```bash
rm -rf .git && git init && git add -A && git commit -m "initial commit"
```

## 8. Fill or remove legal pages

Edit `apps/web/src/routes/_marketing/privacy.tsx` and `terms.tsx` with your
real policy, or remove the routes and their footer links if you don't need them.

## 9. What's next

| You want users to...            | Wait for...                        |
| ------------------------------- | ---------------------------------- |
| Reset passwords / verify email  | Phase 1 (auth experience)          |
| Sign in with Google/GitHub      | Phase 1 (OAuth)                    |
| Edit profile / manage sessions  | Phase 1 (account settings)         |
| Receive transactional emails    | Phase 2 (email)                    |
| Pay for a subscription          | Phase 3 (Stripe billing)           |

See `docs/superpowers/specs/` for the design of each phase.
````

- [x] **Step 2: 提交**

```bash
git add CUSTOMIZE.md
git commit -m "docs: add CUSTOMIZE.md rebranding checklist"
```

---

## Task 10: 总验收（构建 + 类型 + 烟雾测试）

**Files:** 无（仅验证）。

- [x] **Step 1: 全量类型检查 + 构建**

Run: `pnpm check-types`
Expected: 整个 workspace PASS（turbo 会先 `build`，重生成路由树，再 `tsc`）。
Run: `pnpm -F web build`
Expected: 构建成功，产出 `apps/web/dist/server/server.js`。

- [x] **Step 2: 起开发服务器（后台）并烟雾测试 SSR 营销路由**

后台启动 `pnpm dev`（用后台进程工具，勿前台阻塞），等待约 8 秒就绪后执行：

```bash
curl -s http://localhost:3000/ | grep -q "Start free trial" && echo "PASS landing"
curl -s http://localhost:3000/ | grep -q "Acme" && echo "PASS brand"
curl -s http://localhost:3000/pricing | grep -q "Starter" && echo "PASS pricing"
curl -s http://localhost:3000/privacy | grep -qi "privacy" && echo "PASS privacy"
curl -s http://localhost:3000/terms | grep -qi "terms" && echo "PASS terms"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/this-route-does-not-exist
```

Expected: 前五行各打印一个 `PASS ...`；最后一行返回 404 状态。
（`/login`、`/dashboard` 为 `ssr:false`，curl 拿不到完整文案，留待浏览器人工核验。）

- [ ] **Step 3: 浏览器人工核验清单（对照 spec §12）**

打开 http://localhost:3000，逐项确认：

- [ ] `/` 显示完整 Landing（Hero/Features/Pricing/FAQ/Footer），首屏无明显主题闪烁
- [ ] Marketing Header 主题图标点击，light/dark 即时切换；刷新后保持
- [ ] 未登录时 Header 右侧显示 Sign in / Sign up；注册并登录后，回到 `/` 显示 "Go to dashboard"
- [ ] `/login` 已登录访问自动跳 `/dashboard`
- [ ] `/dashboard` 未登录访问自动跳 `/login`；登录后显示左侧 Sidebar + 底部用户卡
- [ ] App User Dropdown 内 System/Light/Dark 三项可切换并持久化；Sign out 生效
- [ ] 窗口缩到 `< 768px`：Marketing 与 App 的汉堡抽屉均可开合（含 Esc 关闭）
- [ ] FAQ 一次只展开一项（原生互斥）
- [ ] 访问 `/nope` 显示无 shell 的 404，"Back home" 可回首页

- [ ] **Step 4: 停止开发服务器，清理**

停止后台 `pnpm dev` 进程。确认无临时文件遗留（`git status` 干净，`.env`/`local.db` 仍被忽略）。

- [ ] **Step 5: （如有最终零散改动）提交**

仅当本任务期间修了 bug 才提交：

```bash
git add <被修文件>
git commit -m "fix(web): address Phase 0 verification findings"
```

---

## Self-Review（计划完成后的自检结论）

**Spec 覆盖**（对照 `2026-06-29-phase-0-saas-starter-shell-design.md` 各节）：

- §3 三 shell 路由 → Task 4/5/6（`_marketing`/`_auth-pages`/`_app`）✅
- §3.2 守卫与跨态（app 守卫、login 反向守卫、Header CTA 三态）→ Task 6 / Task 5 / Task 4 ✅
- §3.3 + §11 404/Error 无 shell + 不调 session → Task 3 ✅
- §4 Marketing（Header/Footer/Hero/Features/Pricing/FAQ + /pricing 独立页 + 法务页）→ Task 4 ✅
- §5 App（Sidebar/UserMenu/移动抽屉/Dashboard/Settings stub）→ Task 6 ✅
- §6 主题（next-themes + FOUC 脚本 + 两个组件 + tokens）→ Task 2 ✅
- §7 三个常量文件 → Task 1 ✅
- §8 README 重写 + CUSTOMIZE.md → Task 8 / Task 9 ✅
- §9 文件清单（增/改/移/删）→ Task 1–7 全覆盖 ✅
- §12 验收标准 → Task 7（#10/#11）+ Task 10（#1–9、#14–16）✅

**与 spec 的有意偏差（已在前置分析说明）：**

- §10 的 `shadcn add accordion/sheet/avatar` **未采用**：改用原生 `<details name>`（FAQ 互斥手风琴）、受控遮罩抽屉（移动导航）、图标圆点（头像）。原因：消除 shadcn 注册表/网络/生成 API 的不确定性与新依赖，同样满足 UX 与无障碍。功能等价，更省。
- §9.2 提到的 `lucide-react` 版本对齐：实测 `apps/web` 未使用 lucide，故安全统一为 catalog `^0.546.0`（Task 1）。

**类型/命名一致性自检：** `PricingTier.cta.to` 固定字面量 `"/login"` 以满足 TanStack `Link` 的 `to` 类型；`APP_NAV_ITEMS.to` 用联合字面量 `"/dashboard" | "/settings"`；`ThemeMenuItems` 的 `onValueChange` 用 `String(value)` 规避 `any`；各组件导出名与消费处一致（`MarketingHeader`/`MarketingFooter`/`Hero`/`Features`/`PricingSection`/`Faq`/`Sidebar`/`MobileTopbar`/`UserMenu`/`SidebarNav`/`NotFound`/`ErrorPage`/`ThemeProvider`/`ThemeToggleIcon`/`ThemeMenuItems`）。

**占位符扫描：** 计划内所有 `TODO`/占位文案均为**产物源码中应存在的换皮提示**（spec 明确要求），非计划自身的待办空缺。
