import "dotenv/config";
import { defineEnv } from "envin";
import * as z from "zod";

import type { Preset } from "envin/types";

export const preset = {
  id: "db",
  server: {
    DATABASE_URL: z.string().default(""),
  },
} as const satisfies Preset;

export const env = defineEnv({
  ...preset,
});
