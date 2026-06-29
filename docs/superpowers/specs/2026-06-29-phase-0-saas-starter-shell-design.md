# Phase 0 · SaaS 启动模板外壳设计

- 日期：2026-06-29
- 状态：已通过 brainstorming 评审，待用户复核 spec 后编写实现计划
- 范围：openstarter 转型为「Indie SaaS 全家桶」启动模板的第 0 期 —— 仅完成开箱外壳（Landing / 双 shell 路由 / 主题 / 文档），不含业务子系统

## 1. 背景与定位

openstarter 当前已具备完整的全栈技术接线（TanStack Start + Hono RPC + Better-Auth + Drizzle + Tailwind v4 + shadcn），但 `apps/web` 的可见内容仅有：

- 首页：ASCII 标题 + 健康检查指示灯
- `/login`：注册/登录双表单
- `/_auth/dashboard`：带鉴权守卫的「Welcome {name}」

距离「clone 完即可开始写业务」还差一整层「开箱体验」。本文档定义将其打磨成 **Indie SaaS 启动模板** 的第 0 期工作。

### 整体路线图

模板的最终形态由五个 Phase 组成。本设计仅涵盖 Phase 0：

| Phase | 内容 | 依赖 | 本文档 |
|---|---|---|---|
| **0** | 模板外壳：路由布局、Landing、主题、文档 | — | ✅ 本文档 |
| 1 | 鉴权体验完整化（密码重置、邮箱验证、OAuth、账户设置） | 0、2 | 后续 |
| 2 | 邮件能力（Resend + React Email） | — | 后续 |
| 3 | Stripe 订阅 / 计费 | 1、2 | 后续 |
| 4 | 文档与 DX 收尾（SEO、CONTRIBUTING、`/docs` 等） | 0–3 | 后续 |

Phase 编号采用「依赖优先」而非「时间优先」，1 与 2 可并行实现。

## 2. 目标与非目标

### 目标

- 一次性把模板的**视觉骨架**与**导航架构**定下来，让后续 Phase 直接挂功能。
- clone + `pnpm install` + `pnpm db:push` + `pnpm dev` 后访问 `/`，看到一个**可信、可直接换皮**的 SaaS Landing 页（Hero / Features / Pricing / FAQ / Footer 全段落齐备）。
- 登录态用户访问 `/dashboard`，看到带左侧 Sidebar、移动端 Drawer、含主题切换与登出的 App shell。
- 提供一份 `CUSTOMIZE.md`，使用者按 checklist 顺序操作即可完成换皮，**不需要任何 setup 脚本**。
- 重写 `README.md`，按「Quick start → What's in the box → Project structure → Customizing → Deployment → Roadmap」组织。
- 全部品牌相关与营销内容收敛到 3 个常量文件（`branding.ts` / `marketing/pricing.ts` / `marketing/faq.ts`），换皮 = 改这 3 个文件。

### 非目标

- ❌ 不写 setup / rename / scaffolding 脚本（明确走「纯文档」路线，详见 §13 决议记录）。
- ❌ 不接 Stripe，Pricing 卡片的 CTA 仅为 `<Link to="/login" />`，留 `TODO(phase-3)` 注释。
- ❌ 不动 Better-Auth 配置；不加 OAuth；不实现密码重置 / 邮箱验证（Phase 1）。
- ❌ 不引入邮件 provider；不写邮件模板（Phase 2）。
- ❌ `/settings` 仅 H1 + "Coming soon" 占位（Phase 1）。
- ❌ Dashboard 不加 metric / chart / activity feed。
- ❌ Privacy / Terms 仅占位（标题 + 提示用户替换）。
- ❌ 不加 sitemap / robots / OG image（Phase 4）。
- ❌ 不加 i18n / Admin / RBAC / team / 任何业务逻辑。
- ❌ 不动 `packages/api`、`packages/auth`、`packages/db` 三个 workspace 包的对外契约。

## 3. 路由架构

### 3.1 三个 Pathless Layout

以 TanStack Router 的 pathless layout（`_xxx/route.tsx`）划分三个互不污染的 shell：

```
apps/web/src/routes/
├── __root.tsx                    # 仅 <html>/<head>/全局 providers，无视觉 chrome
│
├── _marketing/                   # Marketing shell：Header + Outlet + Footer
│   ├── route.tsx
│   ├── index.tsx                 # "/"        Landing
│   ├── pricing.tsx               # "/pricing" 独立定价页
│   ├── privacy.tsx               # "/privacy" 占位
│   └── terms.tsx                 # "/terms"   占位
│
├── _auth-pages/                  # 登录类页面 shell：居中卡片、仅顶部 Logo
│   ├── route.tsx
│   └── login.tsx                 # "/login"  保留现有 SignIn/SignUp 切换
│
├── _app/                         # App shell：左 Sidebar + 顶端移动 bar
│   ├── route.tsx                 # 含 session 守卫
│   ├── dashboard.tsx             # "/dashboard"
│   └── settings.tsx              # "/settings" stub
│
└── api/$.ts                      # 不动
```

URL 对外仍是 `/`、`/login`、`/dashboard` 等扁平形式（pathless 不进入 URL）。

### 3.2 守卫与跨态行为

- `_app/route.tsx` 沿用当前 `_auth/route.tsx` 的 `beforeLoad`：无 session 则 `throw redirect({ to: "/login" })`。
- `_auth-pages/route.tsx` 新增反向守卫：已登录用户访问 `/login` 自动 `redirect({ to: "/dashboard" })`。
- `_marketing/*` **不做**鉴权检查；Marketing Header 内的 CTA 通过 `authClient.useSession()` 客户端判定，登录态 → 「Go to dashboard」，未登录 → 「Sign in / Sign up」。
- Marketing 首屏防 CTA 闪烁：未确定 session 状态时按 `data-state="unknown"` 渲染骨架占位。

### 3.3 404 / Error 不进入任何 shell

- `defaultNotFoundComponent` 与 `defaultErrorComponent` 都渲染**无 shell 居中页**（Logo + 文案 + 单按钮），充当全局逃生页。
- 出错时不渲染主题切换、不调用 session API，避免二次异常。

## 4. Marketing 区

### 4.1 Header

桌面端布局（从左到右）：

```
[Logo {BRAND_NAME}]  Features  Pricing  FAQ        [☀/☾]   [Sign in] [Sign up]
                       │         │       │           │           ↑
                  /#features  /pricing  /#faq     单图标       登录态统一替换为
                                                              [Go to dashboard]
```

- Logo 文字直接读 `BRAND_NAME` 常量；左侧可选 16px lucide 占位图标。
- 中部 nav：Features 与 FAQ 是同页锚点（`/#features`、`/#faq`），Pricing 是独立路由 `/pricing`。
- 右侧主题切换用 `<ThemeToggleIcon>` 单图标按钮。
- 鉴权 CTA 三态：`unknown` → 灰色骨架；`unauthenticated` → 两个按钮；`authenticated` → 单按钮「Go to dashboard」。

移动端：左 Logo / 右汉堡 → Drawer 含所有 nav 项与 CTA。Drawer 用 `@base-ui/react` 的 Dialog/Sheet。

### 4.2 Landing 段落

所有占位文案集中在每个组件文件顶部的 `const COPY = { ... }`，并配 `// TODO: replace with your product copy`。

#### Hero
- 居中堆叠：H1（≤8 词）+ 副标题（1–2 句）+ 主 CTA「Start free trial」→ `/login` + 次 CTA「View pricing」→ `/pricing`。
- 文字下方放一个**占位产品截图框**：圆角 + 阴影 + 内部渐变 + 弱水印「Your product preview goes here」。
- 不放 logo bar / 「Trusted by」。

#### Features
- 3 列网格（移动端单列），3 张卡片。
- 每卡片：lucide 图标 + 标题 + 1–2 句描述。
- 默认占位卡（演示「3 个核心卖点」写法，非自我宣传）：
  1. **Type-safe end to end**
  2. **Auth out of the box**
  3. **Stripe-ready**

#### Pricing
- 3 档定价卡（Starter / Pro / Enterprise），水平排列，移动端堆叠。
- Pro 卡 `ring-2 ring-primary` 高亮 + 右上角「Most popular」徽标。
- 每卡：档位名、月费、3–5 条 features bullet（lucide `Check` 图标）、CTA 按钮。
- **Phase 0 行为**：所有 CTA `<Link to="/login" />`；卡片源码内 `// TODO(phase-3): wire to Stripe checkout` 注释。
- 价格 / features 抽到 `apps/web/src/lib/marketing/pricing.ts`，组件只读不写。

#### FAQ
- 6 条占位问答，用 shadcn Accordion。
- 单开多收（一次只展开一个）。
- 问答抽到 `apps/web/src/lib/marketing/faq.ts`。

### 4.3 Footer

四列网格（移动端两列或单列）：

| Brand | Product | Legal | Social |
|---|---|---|---|
| Logo + 一句话 tagline | Features / Pricing / FAQ | Privacy / Terms | GitHub / X / Discord |

底部一行：`© {year} {BRAND_NAME}`，年份从 `new Date().getFullYear()` 读取。
社交链接从 `SOCIAL_LINKS` 常量读取。

### 4.4 `/pricing` 独立页

独立路由 `/pricing` 复用同一份 `<PricingSection>` 组件（即与 Landing 中嵌入的版本一致），外加一段顶部 H1 与一段简短引导文案。`<PricingTable>` 组件**预留**但 Phase 0 不开发其特性对比表，文件留空骨架 + `// TODO(phase-3): expand to a comparison table` 注释。Phase 3 接 Stripe 时再扩充。

## 5. App 区

### 5.1 Sidebar

桌面端固定左侧，宽 `256px`，从顶到底三段：

```
┌─────────────────┐
│  Logo {Brand}   │  56px，下边一条 border
├─────────────────┤
│ ▣ Dashboard     │  中部 nav，active = bg-accent
│ ◎ Settings      │  lucide 图标 + 文字
│   (more later)  │
├─────────────────┤
│ [avatar] Name ▾ │  底部 User 卡，点击向上展开 Dropdown
└─────────────────┘
```

User Dropdown 内容（自下向上展开）：
1. 头部：头像（lucide `User` 占位，Phase 1 接 Better-Auth 头像字段）+ Name + email
2. 分隔线
3. `Settings` → `/settings`
4. Theme 子菜单：System / Light / Dark（写入 `next-themes`）
5. 分隔线
6. `Sign out`（红色，调用 `authClient.signOut()`）

### 5.2 移动端

- Sidebar 隐藏，顶部 48px 极简 bar（`<MobileTopBar>`）：左汉堡 + 右当前页标题（或空）。
- 点汉堡 → 从左滑入 Drawer，复用桌面端 Sidebar 全部内容（含 User Dropdown）。

### 5.3 Dashboard 内容（Phase 0 不深做）

- H1 `Dashboard`
- 一句欢迎语 `Welcome back, {user.name}.`
- 一张 placeholder Card：标题 `Get started`，三条 bullet 链接：
  - `/settings`
  - `CUSTOMIZE.md`（仓库相对链接）
  - `README.md`
- 卡片底部一行 `// TODO: replace with your app's main view` 注释（源码内）。

### 5.4 Settings 内容（Phase 0 stub）

- H1 `Settings`
- 单段说明：「Account settings will be available once Phase 1 ships. See `docs/superpowers/specs/` for the roadmap.」
- 内部 `// TODO(phase-1)` 注释。

## 6. 主题切换

### 6.1 接入 next-themes

- `next-themes` 已在 catalog（`apps/web/package.json` 已 `"next-themes": "catalog:"`）。
- `__root.tsx` 引入 `ThemeProvider`：`attribute="class"`、`defaultTheme="system"`、`enableSystem`、`disableTransitionOnChange`。
- 删除现有 `<html lang="en" className="dark">` 的硬编码 `dark` class，改由 `ThemeProvider` 动态注入。
- `<html>` 添加 `suppressHydrationWarning`。

### 6.2 SSR / FOUC

- TanStack Start 是 SSR，必须在 hydrate 前同步注入 theme class，否则首屏会闪。
- 实现：在 `__root.tsx` 的 `<head>` 内插入一段 `<script dangerouslySetInnerHTML>`，逻辑：
  - 读 `localStorage.getItem('theme')`，取不到则 `matchMedia('(prefers-color-scheme: dark)')`。
  - 据此给 `document.documentElement` 加 `dark` 或 `light` class。
- 该脚本不依赖任何模块，纯字符串注入。
- **实现期需验证**：`next-themes` 在 TanStack Start SSR 环境下的水合行为。若发现 hydration mismatch 仍存在，回退方案是把 `ThemeProvider` 改为 client-only（用 `<ClientOnly>` 包裹或 `if (typeof window === 'undefined') return children`），并依赖上述 FOUC 脚本作为唯一 source of truth。

### 6.3 两个暴露组件

- `<ThemeToggleIcon>` —— 单按钮，sun ↔ moon 互换；Marketing Header 用。点击 = `setTheme(theme === 'dark' ? 'light' : 'dark')`，不走 system。
- `<ThemeMenuItems>` —— 一组 `DropdownMenuItem`，System / Light / Dark 三项；App 区 User Dropdown 用。

### 6.4 Tailwind tokens

- `apps/web/src/index.css` 已有 `:root` / `.dark` 双套变量。Phase 0 校对：所有新建 Marketing 与 App 组件用 token 而非具体颜色（`bg-background` / `text-foreground` / `border` / `bg-card` / `bg-accent` / `text-primary` 等），保证主题切换无遗漏。

## 7. 品牌与内容抽象

所有跨文件可换值收敛到 **3 个文件**，使 `CUSTOMIZE.md` 的 checklist 简洁到「打开这 3 个文件改完事」：

### 7.1 `apps/web/src/lib/branding.ts`

```ts
// TODO: replace these with your brand values
export const BRAND_NAME = "Acme";
export const BRAND_TAGLINE = "Ship your SaaS in days, not months.";
export const SOCIAL_LINKS = {
  github: "https://github.com/your-org/your-repo",
  x: "https://x.com/your-handle",
  discord: "https://discord.gg/your-invite",
} as const;
export const COPYRIGHT_YEAR_START = 2026;
```

`__root.tsx` 的 `<title>`、Header Logo、Footer brand 区、邮件落款占位等全部从此读取。

### 7.2 `apps/web/src/lib/marketing/pricing.ts`

```ts
import type { LucideIcon } from "lucide-react";
import { Rocket, Sparkles, Building2 } from "lucide-react";

export type PricingTier = {
  id: "starter" | "pro" | "enterprise";
  name: string;
  icon: LucideIcon;
  priceMonthly: number | "custom";
  currency: "USD";
  description: string;
  features: readonly string[];
  cta: { label: string; href: string };
  highlight?: boolean;
};

// TODO(phase-3): replace with Stripe Products fetched from the API
export const PRICING_TIERS: readonly PricingTier[] = [
  { id: "starter", name: "Starter", icon: Rocket, priceMonthly: 0, currency: "USD",
    description: "For solo builders shipping their first product.",
    features: ["1 project", "Up to 1K MAU", "Community support"],
    cta: { label: "Get started", href: "/login" } },
  { id: "pro", name: "Pro", icon: Sparkles, priceMonthly: 29, currency: "USD",
    description: "Everything you need to grow a real business.",
    features: ["Unlimited projects", "Up to 50K MAU", "Email support", "Custom domains"],
    cta: { label: "Start free trial", href: "/login" }, highlight: true },
  { id: "enterprise", name: "Enterprise", icon: Building2, priceMonthly: "custom", currency: "USD",
    description: "Scale-grade controls and dedicated support.",
    features: ["Unlimited MAU", "SSO / SAML", "Dedicated CSM", "SLA & DPA"],
    cta: { label: "Contact sales", href: "/login" } },
] as const;
```

`<PricingSection>` 与 `<PricingTable>` 全部从这里 map。CTA `href` 在 Phase 3 改为指向 Stripe Checkout 创建端点；类型可不变。

### 7.3 `apps/web/src/lib/marketing/faq.ts`

```ts
// TODO: replace with your own FAQ entries
export const FAQ_ENTRIES = [
  { q: "Is there a free trial?", a: "Yes, the Starter tier is free forever." },
  { q: "Which payment methods do you accept?", a: "All major credit cards via Stripe." },
  { q: "Can I cancel anytime?", a: "Yes, you can downgrade or cancel from your account settings." },
  { q: "Where is my data stored?", a: "Your data lives in your own database connection." },
  { q: "Do you offer refunds?", a: "We offer prorated refunds within the first 14 days." },
  { q: "How do I contact support?", a: "Email support@your-domain.com or open a GitHub issue." },
] as const;
```

`<FAQ>` 组件从这里 map 渲染 Accordion。

## 8. 文档

### 8.1 `README.md`（整体重写）

骨架与各节顺序：

1. 项目名 + 一句话定位 + 三句「What you get」
2. **Quick start**：
   ```bash
   pnpm install
   cp apps/web/.env.example apps/web/.env
   # edit .env，至少生成新的 BETTER_AUTH_SECRET
   pnpm db:push
   pnpm dev
   ```
3. **What's in the box**：紧凑表（能力 → 实现技术），含 Routing / Backend / Auth / DB / UI / Theming / Styling / Monorepo / Email *(planned)* / Billing *(planned)*。
4. **Project structure**：`apps/` 与 `packages/` 的目录树（精简版）。
5. **Customizing the template**：一句话引导到 `CUSTOMIZE.md`。
6. **Available scripts**：pnpm 命令表（基本沿用现有 README 的列表）。
7. **Deployment**：Node 部署说明（保留现有），列出必需 env 变量。
8. **Roadmap**：Phase 1–4，每条一行说明 + 状态标 `coming soon`。

### 8.2 `CUSTOMIZE.md`（新增，根目录）

替代「setup 脚本」的 checklist，章节顺序：

1. **Rename your project**
   - macOS / Linux 各一条 `find ... -exec sed -i ...` 命令（含安全提示：先 dry-run）
   - 涉及文件清单：根 `package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json` paths、所有 `packages/*/package.json`、所有 `@openstarter/*` import、`apps/web/.env.example`
2. **Set your display name**
   - 改 `apps/web/src/lib/branding.ts` 的 `BRAND_NAME` / `BRAND_TAGLINE` / `SOCIAL_LINKS` / `COPYRIGHT_YEAR_START`
3. **Replace marketing copy**
   - 文件列表：`components/marketing/{hero,features,pricing-section,pricing-table,faq,footer}.tsx`
   - 提示：grep `TODO: replace with your` 找到所有占位文案
4. **Configure pricing**
   - 改 `apps/web/src/lib/marketing/pricing.ts` 的 `PRICING_TIERS`
   - 说明 Phase 3 上 Stripe 后，`PRICING_TIERS` 会变成从 Stripe Products 拉取
5. **Replace FAQ**
   - 改 `apps/web/src/lib/marketing/faq.ts`
6. **Regenerate secrets**
   - `openssl rand -hex 32` → 写入 `apps/web/.env` 的 `BETTER_AUTH_SECRET`
7. **Reset git history**（可选）：`rm -rf .git && git init && git add -A && git commit -m "initial commit"`
8. **Fill or remove legal placeholders**
   - `apps/web/src/routes/_marketing/{privacy,terms}.tsx`
9. **What's next**：表格列出后续 Phase 与对应能力（密码重置 → Phase 1，订阅 → Phase 3 等）

## 9. 文件清单

### 9.1 新增

```
apps/web/src/
├── routes/
│   ├── _marketing/{route,index,pricing,privacy,terms}.tsx
│   ├── _auth-pages/route.tsx
│   └── _app/{route,dashboard,settings}.tsx
├── components/
│   ├── marketing/{header,footer,hero,features,pricing-section,pricing-table,faq}.tsx
│   ├── app/{sidebar,sidebar-nav,user-menu,mobile-topbar}.tsx
│   ├── system/{not-found,error}.tsx
│   ├── theme/{theme-provider,theme-toggle-icon,theme-menu-items}.tsx
│   └── auth/{sign-in-form,sign-up-form}.tsx           # 由 components/ 移入
└── lib/
    ├── branding.ts
    └── marketing/{pricing,faq}.ts

CUSTOMIZE.md                                            # 根目录新增
```

### 9.2 修改

- `apps/web/src/routes/__root.tsx`：接入 `ThemeProvider`、去硬编码 dark、加 FOUC script、`<title>` 读 `BRAND_NAME`、`<html suppressHydrationWarning>`
- `apps/web/src/router.tsx`：配 `defaultNotFoundComponent`、`defaultErrorComponent`
- `apps/web/src/index.css`：校对 dark/light theme tokens 覆盖完整
- `apps/web/components.json`、`packages/ui/components.json`：登记新增的 shadcn 组件
- `packages/ui/src/components/`：`npx shadcn@latest add accordion sheet avatar dropdown-menu -c packages/ui`（已存在的跳过）
- `apps/web/package.json`：核对 `lucide-react` 版本（当前 `^1.8.0` 与 `packages/ui` 的 `^0.546.0` 不一致，对齐为 catalog 引用或直接使用 `packages/ui` 的传递依赖）
- `README.md`：整体重写

### 9.3 移动 / 改名

- `apps/web/src/routes/index.tsx` → `_marketing/index.tsx`（内容大改）
- `apps/web/src/routes/login.tsx` → `_auth-pages/login.tsx`（仅迁移路径 + 反向守卫）
- `apps/web/src/routes/_auth/` 整目录 → `_app/`（含子文件）
- `apps/web/src/components/user-menu.tsx` → `components/app/user-menu.tsx`（形态改造：从 Header 上下拉变成 Sidebar 底部上展开）
- `apps/web/src/components/{sign-in-form,sign-up-form}.tsx` → `components/auth/`（仅移位，内部由 Phase 1 重写）

### 9.4 删除

- `apps/web/src/components/header.tsx`（被 `marketing/header.tsx` + `app/sidebar.tsx` 替代）
- `apps/web/src/routes/index.tsx` 内的 ASCII 标题与原 health check demo 段落（健康检查作为 dev devtool 的 `/api/health` 端点保留，但不再渲染到首页）

## 10. 第三方依赖与 shadcn

### 10.1 已有可直接用

- `next-themes`（catalog）
- `sonner`（已用）
- `lucide-react`（注意版本对齐）
- `@base-ui/react` + `tailwind-merge` + `class-variance-authority`（已在 `packages/ui`）
- 现有 `packages/ui/src/components/`：button、card、checkbox、dropdown-menu、input、label、skeleton、sonner

### 10.2 通过 shadcn 新增到 `packages/ui`

```bash
pnpm dlx shadcn@latest add accordion sheet avatar -c packages/ui
```

- **accordion** —— FAQ 用
- **sheet** —— Marketing 与 App 移动端 Drawer 用
- **avatar** —— App User 卡用

`dropdown-menu` 已存在；如版本落后可跑 `add dropdown-menu` 覆盖（保留即可）。

### 10.3 不引入

- ❌ 不引 `framer-motion`：Phase 0 不做动效；Tailwind 自带的 transition 足够。
- ❌ 不引 `react-hook-form`：现有 `@tanstack/react-form` 已在；Phase 0 不动表单。
- ❌ 不引 `@radix-ui/*` 直接依赖（统一走 `@base-ui/react` 或 shadcn）。

## 11. 渲染时序与边界情况

- **Marketing 首屏防 CTA 闪烁**：`MarketingHeader` 内置三态 `'unknown' | 'unauthenticated' | 'authenticated'`，`unknown` 渲染同尺寸 skeleton，避免 layout shift。
- **`/login` 在登录态自动跳转**：在 `_auth-pages/route.tsx` 的 `beforeLoad` 内 `await authClient.getSession()`；有 session 则 `throw redirect({ to: "/dashboard" })`。
- **`/dashboard` 在未登录态自动跳转**：保留现有逻辑，重定向到 `/login`。
- **`/` 不论登录态都可访问**：Marketing 不做服务端守卫，只在 Header CTA 上根据客户端 session 切换文案。
- **主题切换 SSR 一致性**：依赖 `<head>` 内联脚本在 hydrate 前修正 `<html class>`，配合 `suppressHydrationWarning` 抑制告警。
- **错误页不调用 session**：`NotFound` / `Error` 组件内部不引入 `authClient`，避免出错时连锁报错。
- **404 与 Error 主题**：因不带 ThemeProvider 之外的额外开销，主题 class 仍生效（FOUC 脚本是更外层），用户看到的是当前已应用主题；不提供切换 UI。

## 12. 验收标准（Phase 0 完成的判据）

### 12.1 功能性

1. `pnpm install && pnpm db:push && pnpm dev` 成功启动，无控制台报错。
2. `/` 渲染完整 Landing（Hero / Features / Pricing / FAQ / Footer 5 段齐备），首屏无明显主题闪烁与布局跳动。
3. `/pricing` 独立可访问，复用同一份 `PRICING_TIERS` 数据。
4. `/login` 未登录时显示注册/登录表单；已登录用户访问自动跳转 `/dashboard`。
5. `/dashboard` 已登录可见左侧 Sidebar + 用户卡片；未登录跳 `/login`。
6. 移动端 `< 768px` 下，Marketing 与 App 两端各自的 Drawer 正常工作。
7. 主题切换：Marketing Header 图标点击切换 light/dark 即时生效；App User Dropdown 中 System/Light/Dark 三项切换且刷新后保持。
8. 访问不存在的路径（如 `/nope`）显示无 shell 的 404 页，按钮可返回首页。
9. 类型检查（`pnpm check-types`）零错误。

### 12.2 内容/换皮判据

10. 全工程内 `grep "openstarter"` 仅出现在：根 `package.json` 的 name、`pnpm-workspace.yaml`、`@openstarter/*` 包名与其 import、README、CUSTOMIZE.md 中**作为示例展示的**字符串。`apps/web/src/` 内的可见 UI 文案不出现 `openstarter` 字面量，所有显示名经由 `BRAND_NAME`。
11. `grep -r "TODO" apps/web/src/components/marketing/` 命中数 ≥ 5（每段落至少一处占位提示）。
12. `BRAND_NAME` 改一处生效全站（手动验证：改 `branding.ts` 中的值，Header / Footer / `<title>` / Dashboard 欢迎语全部更新）。
13. `PRICING_TIERS` 增减档位，Landing 与 `/pricing` 同步刷新。

### 12.3 文档判据

14. README 含 Quick start、What's in the box、Project structure、Customizing、Available scripts、Deployment、Roadmap 七节。
15. CUSTOMIZE.md 9 步 checklist 完整，第 1 步含可运行的 `find/sed` 命令，第 6 步含 `openssl rand -hex 32`。
16. CUSTOMIZE.md 第 1 步执行后，运行 `pnpm install && pnpm dev` 应仍可启动（事后验证：在临时目录跑一遍）。

## 13. 已做出的取舍（决议记录）

| 决议 | 选择 | 备择 | 理由 |
|---|---|---|---|
| 模板定位 | Indie SaaS 全家桶 | 通用 / 极简 / 自由组合 | 用户明确 |
| 拆分粒度 | 5 个 Phase，本期为 Phase 0 | 一份 umbrella 设计 | 避免占位符堆砌 |
| 初始化方式 | 纯文档 `CUSTOMIZE.md` | 交互向导 / 单条命令 / 外部 CLI | 用户明确选 C |
| Home 内容 | 真 Landing（合并原 Phase 3） | 占位引导页 / 健康检查 | 用户：「首页就是模版首页」 |
| Landing 段落 | Hero / Features / Pricing / FAQ / Footer | 加 logo bar / testimonials / how-it-works | 最小集 |
| 占位文案 | 可信通用 SaaS 文案 + `TODO` 注释 | lorem ipsum / 模板自述 | 用户确认 |
| 布局架构 | 三 shell（marketing / auth-pages / app） | 单共享 shell / 双 shell | 用户选 Pattern B + 我建议 auth-pages 切出 |
| App nav | 左 Sidebar | 顶栏 / Sidebar + breadcrumb | 用户选 A，主流 SaaS |
| 主题切换位置 | Marketing Header 图标 + App User Dropdown | 仅 Settings 页 | 主流 SaaS |
| 404/Error 是否带主题切换 | 不带 | 带 | 用户明确 |
| Pricing 三档命名 | Starter / Pro / Enterprise | Free / Pro / Team | 用户明确 |
| Pricing 抽 const | Phase 0 就做 | Phase 3 再做 | 用户明确 |
| `/pricing` 独立路由 | 是 | 仅锚点 `/#pricing` | 用户明确 |
| `_auth-pages` 命名 | 保留此名 | `_centered` / `_blank` | 用户认可 |

## 14. 后续 Phase 预告（信息性，不属本期实现）

- **Phase 1（鉴权完整化）**：在 `_auth-pages/` 下新增 `forgot-password`、`reset-password`、`verify-email`；OAuth provider 配置；`_app/settings/{profile,security,sessions}.tsx`。`components/auth/*` 完全重写。
- **Phase 2（邮件）**：新增 `packages/email`（Resend client + React Email 模板）。被 Phase 1 与 3 调用。
- **Phase 3（Stripe）**：`packages/billing`（Stripe SDK 封装）；`packages/db/src/schema/billing.ts`（subscription / customer 表）；`PRICING_TIERS` 切换为「同步 Stripe Products 后的缓存」；webhook handler；`_app/settings/billing.tsx`。
- **Phase 4（DX 收尾）**：sitemap.xml、robots.txt、OG image、`apps/web/src/routes/_marketing/changelog.tsx`（可选）、CONTRIBUTING.md。

Phase 0 的设计已在路由命名（`_marketing` `_app`）、配置抽象（`PRICING_TIERS` 类型）、目录划分（`components/marketing/` `components/app/` `components/auth/`）三处为后续 Phase 留出**加法增量**的空间，预期无需返工。
