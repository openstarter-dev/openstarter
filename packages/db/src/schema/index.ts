/**
 * Stable schema entry point (`@openstarter/db/schema`).
 *
 * This barrel re-exports the schema for the *active* database dialect. The
 * three dialect files (`schema.sqlite`, `schema.postgres`, `schema.mysql`)
 * export the same symbol names and `$inferSelect` / `$inferInsert` types, so
 * callers and drizzle-kit remain dialect-agnostic.
 *
 * Because `export * from <ternary>` is not valid static syntax, the active
 * dialect target below is (re)written at generation time based on
 * `DATABASE_PROVIDER` — equivalent to ShipAny's `db-setup` step. Run
 * `pnpm --filter @openstarter/db db:setup` after changing `DATABASE_PROVIDER`.
 *
 * Default (committed) dialect: sqlite.
 */

// @openstarter/db:schema-active
export * from "./schema.sqlite";
