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
 * - `mysql` maps to `mysql`
 * - `sqlite` / `turso` / `d1` map to `sqlite` (the sqlite family)
 *
 * An unsupported value throws immediately (R1.4/R1.7) so the auth adapter can
 * never be mismatched against the active dialect.
 */
export function getAuthAdapterProvider(provider = env.DATABASE_PROVIDER): AuthAdapterProvider {
  switch (provider) {
    case "postgres":
      return "pg";
    case "mysql":
      return "mysql";
    case "sqlite":
    case "turso":
    case "d1":
      return "sqlite";
    default:
      throw new Error(`Unsupported DATABASE_PROVIDER: ${provider}`);
  }
}
