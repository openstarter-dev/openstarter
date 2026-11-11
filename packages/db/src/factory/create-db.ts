import { createD1Db } from "../drivers/d1";
import { closePostgresDb, createPostgresDb } from "../drivers/postgres";
import type { Database, DbConfig } from "../types";
import { withSqliteCompat } from "./compat/sqlite";

/**
 * Multi-dialect connection factory. Dispatches on `config.provider` and wraps
 * the D1 driver in the sqlite compat proxy so call sites stay dialect-agnostic
 * (`.for("update")` is a no-op and D1 has no interactive transactions).
 *
 * An unsupported `provider` throws immediately (R1.4).
 */
export function createDb(config: DbConfig): Database {
  switch (config.provider) {
    case "d1":
      return withSqliteCompat(createD1Db(), "d1");
    case "postgres":
      return createPostgresDb(config);
    default:
      throw new Error(`Unsupported DATABASE_PROVIDER: ${config.provider}`);
  }
}

/** Close the cached postgres pool for the configured provider (Node only). */
export async function closeDb(config: DbConfig): Promise<void> {
  if (config.provider === "postgres") {
    await closePostgresDb();
  }
}

export type { Database, DbConfig, DbProvider } from "../types";
