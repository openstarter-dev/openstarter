/**
 * Stable schema entry point (`@openstarter/db/schema`).
 *
 * This barrel re-exports the schema for the *active* database dialect. The
 * two dialect files (`schema.sqlite` for D1, `schema.postgres` for postgres)
 * export the same symbol names and `$inferSelect` / `$inferInsert` types, so
 * callers and drizzle-kit remain dialect-agnostic.
 *
 * Because `export * from <ternary>` is not valid static syntax, the active
 * dialect target below is (re)written at generation time based on
 * `DATABASE_PROVIDER` — equivalent to ShipAny's `db-setup` step. Run
 * `pnpm --filter @openstarter/db db:setup` after changing `DATABASE_PROVIDER`.
 *
 * Default (committed) dialect: sqlite (D1 + the test-only sqlite harness).
 */

// @openstarter/db:schema-active
export * from "./schema.sqlite";
