// `dotenv/config` resolves `./.env` from the current working directory:
//   · the web app (dev server / built server) runs with `apps/web` as cwd, so
//     dotenv picks up `apps/web/.env` directly;
//   · drizzle-kit and the db scripts load the same file explicitly (see
//     `drizzle.shared.ts` / `scripts/setup-schema.mjs`);
//   · scripts can still inject values manually (`pnpm with-env`, CI env vars).
// That keeps `apps/web/.env` the single env source for the monorepo.
import "dotenv/config";
import { defineEnv } from "envin";
import * as z from "zod";

import type { Preset } from "envin/types";

export const preset = {
  id: "db",
  server: {
    // Postgres connection string; required for DATABASE_PROVIDER=postgres and
    // ignored by the Cloudflare D1 binding path.
    DATABASE_URL: z.string().default(""),
    DATABASE_PROVIDER: z.string().default("postgres"),
    DB_SCHEMA: z.string().default("public"),
    DB_SINGLETON_ENABLED: z.string().default("false"),
    DB_MAX_CONNECTIONS: z.string().default("1"),
  },
} as const satisfies Preset;

export const env = defineEnv({
  ...preset,
});
