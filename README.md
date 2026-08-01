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
cp .env.example .env                 # 跨端共享的 API 地址（见下方"共享 API 地址"）
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

## 跨端共享 API 地址

`web`（API 宿主）/ `cli` / `desktop` / `mobile` / `extension` 五端共用同一个 API
地址，唯一事实源是**根目录 `.env`** 里的 `OPENSTARTER_API_URL`：

| 端 | 何时读 | 改完如何生效 |
|---|---|---|
| web | （就是宿主，不读此变量） | — |
| cli | 运行期 | 重跑命令即生效 |
| desktop | 运行期 | 重启 app 即生效 |
| mobile | 构建期（`apps/mobile/scripts/env.mjs` 派生为 `EXPO_PUBLIC_API_URL`） | 需重新 `pnpm dev:mobile` |
| extension | 构建期（`apps/extension/wxt.config.ts` 派生为 `VITE_APP_URL`） | 需重新 `pnpm build:extension` |

每端的本地 `.env` 可覆盖根值（例如 mobile 真机调试填局域网 IP）；DATABASE_URL /
BETTER_AUTH_SECRET 等密钥仍由 `apps/web/.env` 维护，未集中到根 .env。

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
| Desktop      | Electron 外壳（远程加载 + electron-builder 打包 + 自动更新），见 `apps/desktop/README.md` |
| CLI          | 命令行工具（设备授权登录 + 基础 CRUD），见 `apps/cli/README.md` |
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
│   └── desktop/     # Electron 外壳（远程加载 web）
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
- `pnpm dev:desktop` — 启动桌面端（同时起 web dev server 与 Electron 窗口）
- `pnpm build:desktop` — 编译桌面端主进程/preload
- `pnpm package:desktop` — 本机打包出三平台安装包（不发布）
- `pnpm release:desktop` — 打包并发布到 GitHub Releases（需要 `GH_TOKEN`）
- `pnpm dev:cli` — 运行 CLI 开发模式（tsx watch）
- `pnpm build:cli` — 构建 CLI（tsup → `apps/cli/dist`）

### CLI

本仓库附带 `@openstarter/cli`，通过 Better Auth 设备授权登录并调用后端 API：

```bash
pnpm build:cli
node apps/cli/dist/index.js --api-url http://localhost:3000 login
node apps/cli/dist/index.js whoami
```

完整文档见 [apps/cli/README.md](./apps/cli/README.md)。

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
