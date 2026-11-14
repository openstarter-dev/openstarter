import { createD1Db } from "../drivers/d1";
import type { Database, DbConfig } from "../types";
import { withSqliteCompat } from "./compat/sqlite";

export function createDb(config: DbConfig): Database {
  return withSqliteCompat(createD1Db(config), "d1");
}

export type { Database, DbConfig, DbProvider } from "../types";
