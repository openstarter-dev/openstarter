import { buildConfigFor, loadWebEnv, resolveDbUrl } from "./src/config/drizzle.shared";

/**
 * drizzle-kit config for LOCAL DEVELOPMENT / migration authoring.
 *
 * Environment comes from `apps/web/.env` (the monorepo's single env source of
 * truth), loaded explicitly below because drizzle-kit's cwd is `packages/db`.
 *
 * Dispatches on `DATABASE_PROVIDER` (mirroring `drizzle.config.prod.ts`):
 *
 * - `d1` (default): authors the sqlite migrations shared with the cloud D1
 *   target against a local file database. A `file:` URL from `apps/web/.env`
 *   is honored; anything else is ignored — the cloud target is managed by
 *   `drizzle.config.prod.ts` via the d1-http driver.
 * - `postgres`: uses the `apps/web/.env` `DATABASE_URL` directly.
 */

loadWebEnv();

const provider = process.env.DATABASE_PROVIDER?.trim() || "d1";

const config = (() => {
  if (provider === "postgres") {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error(
        "DATABASE_URL is required when DATABASE_PROVIDER=postgres (set it in apps/web/.env).",
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
