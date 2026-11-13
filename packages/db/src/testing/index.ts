import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { withSqliteCompat } from "../factory/compat/sqlite";
import * as schema from "../schema";
import type { Database } from "../types";

export function createSqliteTestDb(url: string): Database {
  return withSqliteCompat(drizzle({ client: createClient({ url }), schema }), "sqlite");
}
