import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

import { buildConfigFor, repoRoot, resolveDbUrl } from "./src/config/drizzle.shared";

/**
 * drizzle-kit config for LOCAL DEVELOPMENT / migration authoring.
 *
 * Dispatches on `DATABASE_PROVIDER` (mirroring `drizzle.config.prod.ts`):
 *
 * - `d1` (default): authors the sqlite migrations shared with the cloud D1
 *   target against a local file database. A `file:` URL from the repo-root
 *   `.env` is honored; anything else is ignored — the cloud target is managed
 *   by `drizzle.config.prod.ts` via the d1-http driver.
 * - `postgres`: uses the root `.env` `DATABASE_URL` directly.
 */

loadEnv({ path: resolve(repoRoot, ".env") });

const provider = process.env.DATABASE_PROVIDER?.trim() || "d1";

const config = (() => {
  if (provider === "postgres") {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error(
        "DATABASE_URL is required when DATABASE_PROVIDER=postgres (local drizzle-kit config).",
      );
    }
    return buildConfigFor("postgresql", resolveDbUrl(url));
  }

  if (provider === "d1") {
    const envUrl = process.env.DATABASE_URL;
    const localUrl = envUrl?.startsWith("file:") ? envUrl : "file:local.db";
    return buildConfigFor("sqlite", resolveDbUrl(localUrl));
  }

  throw new Error(
    `Unsupported DATABASE_PROVIDER for local drizzle-kit: ${provider}. Expected one of: postgres, d1.`,
  );
})();

export default config;
