import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineConfig, type Config } from "drizzle-kit";

// The monorepo root: DATABASE_URL like `file:local.db` and apps/web/.env resolve against it.
// monorepo 根目录：`file:local.db` 与 apps/web/.env 都相对它解析。
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const webEnvFile = resolve(repoRoot, "apps/web/.env");

export function loadWebEnv(): void {
  if (existsSync(webEnvFile)) {
    loadDotenv({ path: webEnvFile, quiet: true });
  }
}

export function resolveFileUrl(url: string, baseDir: string): string {
  if (!url.startsWith("file:") || url.startsWith("file://")) {
    return url;
  }

  const pathPart = url.slice(5);
  if (pathPart.startsWith("/")) {
    return url;
  }

  const absolutePath = resolve(baseDir, pathPart);
  return pathToFileURL(absolutePath).href;
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
