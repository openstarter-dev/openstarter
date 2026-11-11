import "dotenv/config";

import { buildConfigFor, resolveDbUrl, resolveDialect } from "./src/config/drizzle.shared";

/**
 * drizzle-kit config for the CLOUD PRODUCTION database.
 *
 * The default target is Cloudflare D1 (credentials via the d1-http driver);
 * setting `DATABASE_PROVIDER=postgres` switches to postgres. The production
 * target is intentionally independent of local dev — point it at a different
 * database or provider than `.env`'s `DATABASE_URL` by exporting the desired
 * variables in the environment before invoking the `db:*:prod` scripts.
 *
 * D1 (default):
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_API_TOKEN
 * Postgres:
 *   DATABASE_PROVIDER=postgres, DATABASE_URL
 *
 * Credentials are only read from the environment — nothing is stored in this
 * file, so it is safe to commit. Required variables are validated explicitly
 * (no `!` casts): a missing variable throws a clear error here instead of
 * silently sending an empty credential to the API.
 */

const provider = process.env.DATABASE_PROVIDER?.trim() || "d1";

/** Fail fast with a clear message when a required env variable is missing. */
function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name} for the production drizzle-kit config (provider: ${provider}).`,
    );
  }
  return value;
}

/** D1 target: d1-http driver over the sqlite migrations shared with local dev. */
function d1Config(): ReturnType<typeof buildConfigFor> {
  return {
    schema: "./src/schema/index.ts",
    out: "./src/migrations/sqlite",
    dialect: "sqlite",
    driver: "d1-http",
    dbCredentials: {
      accountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
      databaseId: requireEnv("CLOUDFLARE_DATABASE_ID"),
      token: requireEnv("CLOUDFLARE_API_TOKEN"),
    },
  } as ReturnType<typeof buildConfigFor>;
}

const config =
  provider === "d1"
    ? d1Config()
    : buildConfigFor(resolveDialect(provider), resolveDbUrl(requireEnv("DATABASE_URL")));

export default config;
