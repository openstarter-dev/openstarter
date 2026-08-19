<div align="center">

# openstarter

**Ship your SaaS in days, not months.**

An opinionated, production-ready full-stack SaaS starter. Clone it, rebrand it,
and start building your product instead of your boilerplate — auth, billing,
i18n, SEO, and six client platforms are already wired up and working together.

</div>

## Features

- **Marketing site** — Polished hero, features, pricing, FAQ, blog (SSR), and
  docs-ready layout, all rebrandable from a single `branding.ts` file.
- **Full auth experience** — Email/password, OAuth (Google/GitHub/Apple), magic
  link, email OTP, passkey, two-factor, anonymous sign-in, password reset,
  organizations & teams, invite codes, powered by Better-Auth.
- **Billing out of the box** — Stripe / PayPal / Alipay / WeChat Pay,
  subscription lifecycle, credit system (FIFO consumption, revocation, history),
  order management, webhook orchestration, customer portal, plan gating.
- **Typed full-stack API** — Hono RPC mounted at `/api/*` with end-to-end type
  safety from server to every client.
- **Six platforms, one codebase** — Web, Desktop (Electron), Mobile (Expo),
  Browser Extension (WXT), CLI, and WeChat Mini-App (Taro) sharing one API,
  auth session, and design system.
- **Transactional email** — Resend + Cloudflare with 7 bilingual React Email
  templates and graceful channel degradation.
- **Internationalization** — inlang/Paraglide, request-scoped locale, works on
  web and mobile.
- **RBAC & API Keys** — Role-based access control with wildcard permission
  matching, plus service-to-service API key authentication.
- **SEO ready** — sitemap.xml, robots.txt, llms.txt, Open Graph, Twitter Card,
  canonical URLs.
- **Admin console** — Built-in admin routes for managing users and the product.

## Why openstarter

Most starters give you a login page and a TODO list. openstarter gives you the
boring 80% that every SaaS needs but nobody wants to build:

- **Production-ready, not demo-ready** — Billing webhooks, credit revocation,
  permission matching, email fallbacks, no-FOUC theming. The edge cases are
  already handled.
- **Truly full-stack, truly typed** — One Node server serves both the app and
  the API; Hono RPC gives you autocomplete from database schema to UI.
- **Multi-platform by default** — Your indie SaaS probably needs a CLI, a
  browser extension, or a mini-app eventually. They're already in the monorepo,
  sharing auth and API.
- **Batteries included, swappable** — SQLite/Turso/Postgres/MySQL via a dialect
  adapter, pluggable analytics and email providers. Start cheap, scale later.
- **Indie-hacker friendly** — One `.env` for the shared API URL, one command to
  run everything, deploy anywhere Node runs.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | TanStack Start + TanStack Router (file-based, SSR) |
| Backend | Hono (mounted at `/api/*`, RPC client) |
| Auth | Better-Auth (sessions, OAuth, 2FA, passkey, orgs) |
| Database | Drizzle ORM — SQLite / Turso (libSQL) / Postgres / MySQL |
| UI | shadcn + Base UI primitives, Tailwind CSS v4, next-themes |
| Monorepo | Turborepo + pnpm workspaces |
| Desktop | Electron (electron-builder + auto-update) |
| Mobile | Expo (React Native) |
| Extension | WXT + React |
| Mini-App | Taro (WeChat) |
| Email | Resend + Cloudflare, React Email |
| Payments | Stripe, PayPal, Alipay, WeChat Pay |
| i18n | inlang / Paraglide |
| Testing | Vitest + fast-check |
| Linting | oxlint + oxfmt |

## Project Structure

```
openstarter/
├── apps/
│   ├── web/         # Full-stack app (TanStack Start + Hono server routes)
│   │   └── src/
│   │       ├── routes/_marketing/   # public marketing pages
│   │       ├── routes/_auth-pages/  # login (centered, no chrome)
│   │       ├── routes/_app/         # authenticated app (sidebar shell)
│   │       ├── routes/admin/        # admin console
│   │       ├── routes/blog/         # blog (SSR via RPC)
│   │       ├── components/          # marketing / app / admin / blog / theme / auth
│   │       └── lib/                 # branding, SEO, permissions, i18n
│   ├── cli/         # CLI tool (device auth login + CRUD)
│   ├── desktop/     # Electron shell (loads web remotely)
│   ├── mobile/      # Expo React Native app
│   ├── extension/   # Chrome browser extension (WXT + React)
│   └── mini-app/    # WeChat mini-app (Taro)
├── packages/
│   ├── api/         # Hono app (20+ routes) + AppType for RPC
│   ├── auth/        # Better-Auth config + RBAC + API Keys + invite codes
│   ├── db/          # Drizzle schema + dialect adapter
│   ├── shared/      # Response envelope, logging, ID, hash, config
│   ├── ui/          # Shared UI components (web + mobile per-platform)
│   ├── i18n/        # Internationalization (inlang/Paraglide)
│   ├── email/       # React Email templates (7 templates, bilingual)
│   ├── billing/     # Subscriptions, credits, payment providers
│   ├── analytics/   # Analytics provider abstraction (web + mobile)
│   ├── monitoring/  # Monitoring (web + mobile)
│   ├── notifications/# Notifications (web + mobile + shared)
│   └── ai/          # AI features (scaffold)
└── docs/            # Architecture & operations docs
```

## Quick Start

```bash
pnpm install
cp .env.example .env
cp apps/web/.env.example apps/web/.env
# Set a strong BETTER_AUTH_SECRET in apps/web/.env:
#   openssl rand -hex 32
pnpm db:push
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The API is served from the
same origin under `/api/*`. For deployment, customization, per-platform
commands, and the full roadmap, see [docs/](./docs) and
[CUSTOMIZE.md](./CUSTOMIZE.md).

## Contact

- **GitHub**: [openstarter-dev/openstarter](https://github.com/openstarter-dev/openstarter) — issues and PRs welcome
- **X (Twitter)**: [@kirin092600](https://x.com/kirin092600)
- **微信**: shilipai0926
- **微信群**: shilipai0926
- **Contributing**: see [CONTRIBUTING.md](./CONTRIBUTING.md)

If openstarter helps you ship faster, consider giving it a ⭐️
