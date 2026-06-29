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
