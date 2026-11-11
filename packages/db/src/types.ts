import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

/**
 * Known database providers. `DATABASE_PROVIDER` is validated at connection
 * time; any value outside this set makes `createDb` throw a config error.
 *
 * Only `postgres` (self-hosted / managed) and `d1` (Cloudflare D1) are
 * supported. A sqlite driver remains available for the test harness only
 * (`@openstarter/db/testing`); it is intentionally not part of this union.
 */
export type DbProvider = "postgres" | "d1";

/**
 * Canonical Drizzle database type surfaced to all call sites.
 *
 * Every dialect is normalized to this single type (backed by the active
 * `@openstarter/db/schema` definitions) so call sites stay stable across
 * providers. The dialect-specific driver results are cast to it; the d1
 * compat proxy keeps the runtime query API uniform for the sqlite-flavored
 * provider.
 */
export type Database = LibSQLDatabase<typeof schema>;

/**
 * Connection configuration for {@link createDb}, typically resolved from the
 * environment by the `db()` singleton accessor.
 */
export type DbConfig = {
  /**
   * Raw provider string. Kept as `string` (not the `DbProvider` union) so an
   * invalid `DATABASE_PROVIDER` reaches `createDb` and throws a clear config
   * error (R1.4) rather than being rejected at the type level.
   */
  provider: string;
  /**
   * Postgres connection URL. Required for `postgres`; ignored by the D1
   * binding path.
   */
  url: string;
  /** Postgres `search_path` schema name. */
  schema?: string;
  /** Reuse a cached connection instance (Node only). */
  singleton?: boolean;
  /** Max pool connections in singleton mode. */
  maxConnections?: number;
};
