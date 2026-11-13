import { createD1Db } from "../drivers/d1";
import { closePostgresDb, createPostgresDb } from "../drivers/postgres";
import type { Database, DbConfig } from "../types";
import { withSqliteCompat } from "./compat/sqlite";

export function createDb(config: DbConfig): Database {
  switch (config.provider) {
    case "d1":
      return withSqliteCompat(createD1Db(config), "d1");
    case "postgres":
      return createPostgresDb(config);
    default:
      throw new Error(`Unsupported DATABASE_PROVIDER: ${config.provider}`);
  }
}

export async function closeDb(config: DbConfig): Promise<void> {
  if (config.provider === "postgres") {
    await closePostgresDb();
  }
}

export type { Database, DbConfig, DbProvider } from "../types";
