/**
 * Shared helpers for the drizzle-kit config files (`drizzle.config.ts` for
 * local development, `drizzle.config.prod.ts` for the cloud production
 * database).
 *
 * Both configs resolve `file:` DATABASE_URLs against the monorepo root — the
 * same rule the runtime sqlite driver applies — so drizzle-kit commands and
 * the running app always land on the same database file.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { defineConfig, type Config } from "drizzle-kit";

import { repoRoot, resolveFileUrl } from "./resolve-file-url";

export { repoRoot };

/**
 * drizzle-kit dialects supported by this workspace, resolved from
 * `DATABASE_PROVIDER`.
 */
export type DrizzleDialect = "sqlite" | "postgresql";

/**
 * Map `DATABASE_PROVIDER` to the matching drizzle-kit dialect.
 *
 * Kept in lockstep with the runtime driver dispatch (`create-db.ts`) and the
 * active schema barrel (`scripts/setup-schema.mjs`) so `db:generate` /
 * `db:migrate` always target the same dialect the app runs on:
 *
 *   postgres            -> postgresql
 *   d1 | unset          -> sqlite (D1 is sqlite-flavored; migrations shared)
 *
 * Any other value throws immediately, mirroring the connection factory's
 * config-error contract (R1.4).
 */
export function resolveDialect(provider: string | undefined): DrizzleDialect {
  switch (provider) {
    case "postgres":
      return "postgresql";
    case undefined:
    case "":
    case "d1":
      return "sqlite";
    default:
      throw new Error(
        `Unsupported DATABASE_PROVIDER: ${provider}. Expected one of: postgres, d1.`,
      );
  }
}

/**
 * `apps/web/.env` — the single environment source of truth for the monorepo.
 *
 * drizzle-kit runs with `packages/db` as its cwd, so dotenv's implicit
 * `./.env` lookup would miss the web app's file. Loading this path explicitly
 * keeps `pnpm -F @openstarter/db db:*` (and the turbo `db:*` tasks) working
 * without any env wrapper.
 */
export const webEnvFile = resolve(repoRoot, "apps/web/.env");

/** Load `apps/web/.env` when it exists (missing file = rely on process env). */
export function loadWebEnv(): void {
  if (existsSync(webEnvFile)) {
    loadDotenv({ path: webEnvFile, quiet: true });
  }
}

/**
 * Normalize a raw `DATABASE_URL` for drizzle-kit: relative `file:` URLs are
 * resolved against the monorepo root, everything else passes through.
 */
export function resolveDbUrl(url: string): string {
  return resolveFileUrl(url, repoRoot);
}

/** The repo-root-relative migrations output directory for a dialect. */
export function migrationsOut(dialect: DrizzleDialect): string {
  return `./src/migrations/${dialect}`;
}

/**
 * Build the drizzle-kit config for the given dialect from a resolved URL.
 * Each branch passes a literal `dialect`, satisfying drizzle-kit's
 * discriminated `Config` union (and its per-dialect `dbCredentials` shape)
 * without casts.
 */
export function buildConfigFor(dialect: DrizzleDialect, url: string): Config {
  const schema = "./src/schema/index.ts";
  const out = migrationsOut(dialect);

  switch (dialect) {
    case "postgresql":
      return defineConfig({ schema, out, dialect: "postgresql", dbCredentials: { url } });
    default:
      return defineConfig({ schema, out, dialect: "sqlite", dbCredentials: { url } });
  }
}
