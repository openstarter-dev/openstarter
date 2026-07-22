import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

/**
 * Known database providers. `DATABASE_PROVIDER` is validated at connection
 * time; any value outside this set makes `createDb` throw a config error.
 */
export type DbProvider = "sqlite" | "turso" | "postgres" | "mysql" | "d1";

/**
 * Canonical Drizzle database type surfaced to all call sites.
 *
 * Every dialect is normalized to this single type (backed by the active
 * `@openstarter/db/schema` definitions) so call sites stay stable across
 * providers. The dialect-specific driver results are cast to it; the compat
 * proxies keep the runtime query API uniform across dialects.
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
  /** Connection URL (or libsql file URL); ignored by the D1 binding path. */
  url: string;
  /** Auth token for remote libsql/Turso. */
  authToken?: string;
  /** Postgres `search_path` schema name. */
  schema?: string;
  /** Reuse a cached connection instance (Node only). */
  singleton?: boolean;
  /** Max pool connections in singleton mode. */
  maxConnections?: number;
};
