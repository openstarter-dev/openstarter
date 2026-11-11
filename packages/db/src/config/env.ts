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
