# openstarter

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Hono, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - Full-stack SSR framework on TanStack Router (unified front + back)
- **TailwindCSS** - Utility-first CSS
- **Shared UI package** - shadcn/ui primitives in `packages/ui`
- **Hono** - Lightweight backend framework (in `packages/api`)
- **Hono RPC** - End-to-end type-safe client/server calls
- **Node** - Platform-agnostic runtime
- **Drizzle** - TypeScript-first ORM
- **SQLite/Turso** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Database Setup

This project uses SQLite with Drizzle ORM.

1. Start the local SQLite database (optional):

```bash
pnpm db:local
```

2. Copy the example environment file:

```bash
cp apps/web/.env.example apps/web/.env
```

3. Update your `.env` file in the `apps/web` directory with the appropriate connection details if needed.

4. Apply the schema to your database:

```bash
pnpm db:push
```

Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.
The API is served from the same origin under `/api/*`.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@openstarter/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Deployment

The app builds to a standard Node server (`apps/web/dist/server/server.js`).

1. Build: `pnpm build`
2. Start: `pnpm --filter web start`

Provide `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` as environment
variables on your host. Deploy anywhere Node runs (Docker, VPS, Vercel, Netlify).

## Project Structure

```
openstarter/
├── apps/
│   └── web/         # Full-stack app (TanStack Start + Hono via server routes)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # Hono app (auth + routes) + AppType for RPC
│   ├── auth/        # Better-Auth configuration
│   └── db/          # Database schema & client
```

## Available Scripts

- `pnpm dev`: Start the app in development mode (http://localhost:3000)
- `pnpm build`: Build the app for production
- `pnpm --filter web start`: Run the production Node server
- `pnpm check-types`: Type-check across the workspace
- `pnpm db:push` / `db:generate` / `db:migrate` / `db:studio` / `db:local`: Drizzle commands
