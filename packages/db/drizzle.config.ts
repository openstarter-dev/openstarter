import dotenv from "dotenv";
import { type Config, defineConfig } from "drizzle-kit";

dotenv.config({
  path: "../../apps/web/.env",
});

/**
 * drizzle-kit dialects supported by this workspace, resolved from
 * `DATABASE_PROVIDER`.
 */
type DrizzleDialect = "sqlite" | "postgresql" | "mysql" | "turso";

/**
 * Map `DATABASE_PROVIDER` to the matching drizzle-kit dialect.
 *
 * Kept in lockstep with the runtime driver dispatch (`create-db.ts`) and the
 * active schema barrel (`scripts/setup-schema.mjs`) so `db:generate` /
 * `db:migrate` always target the same dialect the app runs on:
 *
 *   postgres            -> postgresql
 *   mysql               -> mysql
 *   turso               -> turso (libsql)
 *   sqlite | d1 | unset -> sqlite
 *
 * Any other value throws immediately, mirroring the connection factory's
 * config-error contract (R1.4).
 */
const resolveDialect = (provider: string | undefined): DrizzleDialect => {
  switch (provider) {
    case "postgres":
      return "postgresql";
    case "mysql":
      return "mysql";
    case "turso":
      return "turso";
    case undefined:
    case "":
    case "sqlite":
    case "d1":
      return "sqlite";
    default:
      throw new Error(
        `Unsupported DATABASE_PROVIDER: ${provider}. Expected one of: sqlite, turso, postgres, mysql (or d1).`
      );
  }
};

// Stable schema entry: the barrel re-exports only the active dialect (rewritten
// by `db:setup`), so drizzle-kit reads a single dialect's table definitions.
const schema = "./src/schema/index.ts";
const url = process.env.DATABASE_URL ?? "";

/**
 * Build the drizzle-kit config for the active dialect. Each branch passes a
 * literal `dialect`, satisfying drizzle-kit's discriminated `Config` union
 * (and its per-dialect `dbCredentials` shape) without casts.
 */
const buildConfig = (): Config => {
  const dialect = resolveDialect(process.env.DATABASE_PROVIDER);
  // One migrations folder per dialect: drizzle-kit stores a dialect-specific
  // journal, so dialects must not share an output directory.
  const out = `./src/migrations/${dialect}`;

  switch (dialect) {
    case "postgresql":
      return defineConfig({ schema, out, dialect: "postgresql", dbCredentials: { url } });
    case "mysql":
      return defineConfig({ schema, out, dialect: "mysql", dbCredentials: { url } });
    case "turso":
      return defineConfig({
        schema,
        out,
        dialect: "turso",
        dbCredentials: { url, authToken: process.env.DATABASE_AUTH_TOKEN },
      });
    default:
      return defineConfig({ schema, out, dialect: "sqlite", dbCredentials: { url } });
  }
};

export default buildConfig();
