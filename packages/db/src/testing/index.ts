/**
 * Test-only sqlite harness (`@openstarter/db/testing`).
 *
 * `sqlite` is no longer a supported runtime provider (`postgres` and `d1`
 * only), but the api/auth/billing test suites bootstrap real databases from
 * raw sqlite DDL in temp files. This module exposes the sqlite/libsql driver
 * for that purpose only — it is intentionally not reachable through
 * `createDb` or the `DATABASE_PROVIDER` env contract.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { withSqliteCompat } from "../factory/compat/sqlite";
import * as schema from "../schema";
import type { Database } from "../types";

/**
 * Create a sqlite-backed Drizzle database for tests.
 *
 * `url` is passed through to `@libsql/client` untouched (absolute `file:` URLs
 * or `:memory:`). The result is wrapped in the sqlite compat proxy so test
 * code shares the runtime query surface (`.for("update")` no-op); unlike D1,
 * interactive transactions are supported and preserved.
 */
export function createSqliteTestDb(url: string): Database {
  return withSqliteCompat(drizzle({ client: createClient({ url }), schema }), "sqlite");
}
