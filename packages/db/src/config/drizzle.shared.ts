import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { defineConfig, type Config } from "drizzle-kit";

import { repoRoot, resolveFileUrl } from "./resolve-file-url";

export { repoRoot };

export type DrizzleDialect = "sqlite" | "postgresql";

export function resolveDialect(provider: string | undefined): DrizzleDialect {
  switch (provider) {
    case "postgres":
      return "postgresql";
    case undefined:
    case "":
    case "d1":
      return "sqlite";
    default:
      throw new Error(
        `Unsupported DATABASE_PROVIDER: ${provider}. Expected one of: postgres, d1.`,
      );
  }
}

export const webEnvFile = resolve(repoRoot, "apps/web/.env");

export function loadWebEnv(): void {
  if (existsSync(webEnvFile)) {
    loadDotenv({ path: webEnvFile, quiet: true });
  }
}

export function resolveDbUrl(url: string): string {
  return resolveFileUrl(url, repoRoot);
}

export function migrationsOut(dialect: DrizzleDialect): string {
  return `./src/migrations/${dialect}`;
}

export function buildConfigFor(dialect: DrizzleDialect, url: string): Config {
  const schema = "./src/schema/index.ts";
  const out = migrationsOut(dialect);

  switch (dialect) {
    case "postgresql":
      return defineConfig({ schema, out, dialect: "postgresql", dbCredentials: { url } });
    default:
      return defineConfig({ schema, out, dialect: "sqlite", dbCredentials: { url } });
  }
}
