import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import type { Database } from "../server";
import { withSqliteCompat } from "../sqlite-compat";
import * as schema from "../schema";

export function createSqliteTestDb(url: string): Database {
  return withSqliteCompat(drizzle({ client: createClient({ url }), schema }), "sqlite");
}
