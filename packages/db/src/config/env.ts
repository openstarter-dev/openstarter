import "dotenv/config";
import { defineEnv } from "envin";
import * as z from "zod";

import type { Preset } from "envin/types";

export const preset = {
  id: "db",
  server: {
    DATABASE_URL: z.string().default("file:local.db"),
    DATABASE_PROVIDER: z.string().default("sqlite"),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    DB_SCHEMA: z.string().default("public"),
    DB_SINGLETON_ENABLED: z.string().default("false"),
    DB_MAX_CONNECTIONS: z.string().default("1"),
  },
} as const satisfies Preset;

export const env = defineEnv({
  ...preset,
});