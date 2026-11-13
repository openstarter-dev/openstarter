import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webEnvFile = resolve(scriptDir, "..", "..", "..", "apps", "web", ".env");
if (existsSync(webEnvFile)) {
  loadEnv({ path: webEnvFile, quiet: true });
}

const DIALECT_BY_PROVIDER = {
  postgres: "schema.postgres",
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
      `Unsupported DATABASE_PROVIDER: ${provider}. Expected one of: ${Object.keys(DIALECT_BY_PROVIDER).join(", ")}`,
    );
  }
  return dialect;
};

const main = () => {
  const barrelPath = join(scriptDir, "..", "src", "schema", "index.ts");
  const dialect = resolveDialect(process.env.DATABASE_PROVIDER);

  const source = readFileSync(barrelPath, "utf8");
  const lines = source.split("\n");
  const markerIndex = lines.findIndex((line) => line.includes(ACTIVE_MARKER));
  if (markerIndex === -1 || markerIndex + 1 >= lines.length) {
    throw new Error(`Could not find active-dialect marker "${ACTIVE_MARKER}" in ${barrelPath}`);
  }

  lines[markerIndex + 1] = `export * from "./${dialect}";`;
  writeFileSync(barrelPath, lines.join("\n"));
  process.stdout.write(`[db] active schema dialect -> ${dialect}\n`);
};

main();
