/**
 * `@openstarter/db` root entry.
 *
 * Server-side database access — the `db()` singleton accessor — lives in
 * `@openstarter/db/server`; table definitions live in `@openstarter/db/schema`.
 * This root re-exports the connection factory and shared types for
 * convenience.
 */

export { closeDb, createDb } from "./create-db";
export type { Database, DbConfig, DbProvider } from "./types";
