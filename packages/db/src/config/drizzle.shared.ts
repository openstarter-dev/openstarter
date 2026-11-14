import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { defineConfig, type Config } from "drizzle-kit";

import { repoRoot, resolveFileUrl } from "./resolve-file-url";

export { repoRoot };

export const webEnvFile = resolve(repoRoot, "apps/web/.env");

export function loadWebEnv(): void {
  if (existsSync(webEnvFile)) {
    loadDotenv({ path: webEnvFile, quiet: true });
  }
}

export function resolveDbUrl(url: string): string {
  return resolveFileUrl(url, repoRoot);
}

export function buildConfigFor(url: string): Config {
  return defineConfig({
    schema: "./src/schema/index.ts",
    out: "./src/migrations/sqlite",
    dialect: "sqlite",
    dbCredentials: { url },
  });
}
