/**
 * better-auth `drizzleAdapter` provider mapping.
 *
 * Normalizes `DATABASE_PROVIDER` into the provider identifier accepted by
 * better-auth's `drizzleAdapter` (`"pg" | "mysql" | "sqlite"`), so the auth
 * adapter always matches the dialect loaded by `@openstarter/db/schema`
 * instead of a hard-coded `provider: "pg"` (R1.7).
 *
 * Pure function with no I/O, so it is trivially unit- and property-testable.
 */

import { env } from "./env";

/** Provider identifiers accepted by better-auth's `drizzleAdapter`. */
export type AuthAdapterProvider = "pg" | "mysql" | "sqlite";

/**
 * Map `DATABASE_PROVIDER` to the better-auth adapter provider identifier.
 *
 * - `postgres` maps to `pg`
 * - `d1` maps to `sqlite` (D1 is sqlite-flavored; the schema barrel exports
 *   the sqlite dialect for it)
 *
 * An unsupported value throws immediately (R1.4/R1.7) so the auth adapter can
 * never be mismatched against the active dialect.
 */
export function getAuthAdapterProvider(provider = env.DATABASE_PROVIDER): AuthAdapterProvider {
  switch (provider) {
    case "postgres":
      return "pg";
    case "d1":
      return "sqlite";
    default:
      throw new Error(`Unsupported DATABASE_PROVIDER: ${provider}`);
  }
}
