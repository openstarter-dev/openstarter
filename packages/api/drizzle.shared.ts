import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The monorepo root: apps/web/.env resolves against it.
// monorepo 根目录：apps/web/.env 相对它解析。
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const webEnvFile = resolve(repoRoot, "apps/web/.env");

// For drizzle-kit configs (db:generate / db:migrate:prod).
// 供 drizzle-kit 配置（db:generate / db:migrate:prod）加载 apps/web/.env。
export function loadWebEnv(): void {
  if (existsSync(webEnvFile)) {
    process.loadEnvFile(webEnvFile);
  }
}
