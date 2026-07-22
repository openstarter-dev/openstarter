/**
 * Schema dialect setup (equivalent to ShipAny's `db-setup`).
 *
 * Rewrites the active dialect target in `src/schema/index.ts` based on the
 * `DATABASE_PROVIDER` environment variable, so the stable `@openstarter/db/schema`
 * entry re-exports the matching dialect. `export * from <ternary>` is not valid
 * static syntax, hence this generation step.
 *
 *   DATABASE_PROVIDER=postgres node scripts/setup-schema.mjs
 *
 * Mapping: postgres -> schema.postgres, mysql -> schema.mysql,
 *          sqlite | turso | d1 (default) -> schema.sqlite
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIALECT_BY_PROVIDER = {
  postgres: "schema.postgres",
  mysql: "schema.mysql",
  sqlite: "schema.sqlite",
  turso: "schema.sqlite",
  d1: "schema.sqlite",
};

const ACTIVE_MARKER = "// @openstarter/db:schema-active";

const resolveDialect = (provider) => {
  if (!provider) {
    return "schema.sqlite";
  }
  const dialect = DIALECT_BY_PROVIDER[provider];
  if (!dialect) {
    throw new Error(
      `Unsupported DATABASE_PROVIDER: ${provider}. Expected one of: ${Object.keys(DIALECT_BY_PROVIDER).join(", ")}`
    );
  }
  return dialect;
};

const main = () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const barrelPath = join(here, "..", "src", "schema", "index.ts");
  const dialect = resolveDialect(process.env.DATABASE_PROVIDER);

  const source = readFileSync(barrelPath, "utf8");
  const lines = source.split("\n");
  const markerIndex = lines.findIndex((line) => line.includes(ACTIVE_MARKER));
  if (markerIndex === -1 || markerIndex + 1 >= lines.length) {
    throw new Error(
      `Could not find active-dialect marker "${ACTIVE_MARKER}" in ${barrelPath}`
    );
  }

  lines[markerIndex + 1] = `export * from "./${dialect}";`;
  writeFileSync(barrelPath, lines.join("\n"));
  process.stdout.write(`[db] active schema dialect -> ${dialect}\n`);
};

main();
