import { createD1Db } from "../drivers/d1";
import { closeMysqlDb, createMysqlDb } from "../drivers/mysql";
import { closePostgresDb, createPostgresDb } from "../drivers/postgres";
import { createSqliteDb } from "../drivers/sqlite";
import type { Database, DbConfig } from "../types";
import { withMysqlCompat } from "./compat/mysql";
import { withSqliteCompat } from "./compat/sqlite";

/**
 * Multi-dialect connection factory. Dispatches on `config.provider` and wraps
 * the driver result in the matching compatibility proxy so call sites stay
 * dialect-agnostic.
 *
 * An unsupported `provider` throws immediately (R1.4).
 */
export function createDb(config: DbConfig): Database {
  switch (config.provider) {
    case "d1":
      return withSqliteCompat(createD1Db(), "d1");
    case "sqlite":
    case "turso":
      return withSqliteCompat(createSqliteDb(config), config.provider);
    case "mysql":
      return withMysqlCompat(createMysqlDb(config));
    case "postgres":
      return createPostgresDb(config);
    default:
      throw new Error(`Unsupported DATABASE_PROVIDER: ${config.provider}`);
  }
}

/** Close any cached TCP connection for the configured provider (Node only). */
export async function closeDb(config: DbConfig): Promise<void> {
  if (config.provider === "postgres") {
    await closePostgresDb();
    return;
  }
  if (config.provider === "mysql") {
    await closeMysqlDb();
  }
}

export type { Database, DbConfig, DbProvider } from "../types";
