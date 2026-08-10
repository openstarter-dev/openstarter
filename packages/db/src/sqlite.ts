import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { isCloudflareWorker } from "./runtime";
import * as schema from "./schema";
import type { Database, DbConfig } from "./types";

// libsql/SQLite singleton (Node only).
let sqliteDbInstance: Database | null = null;

/**
 * Resolve relative `file:` URLs against the monorepo root.
 * This ensures that DATABASE_URL=file:local.db resolves to the repo root
 * regardless of the current working directory.
 */
function resolveFileUrl(url: string): string {
  // Only process file: URLs that are relative (not file:// absolute URLs)
  if (!url.startsWith("file:") || url.startsWith("file://")) {
    return url;
  }

  const pathPart = url.slice(5); // Remove "file:" prefix
  if (pathPart.startsWith("/")) {
    // Absolute path, return as-is
    return url;
  }

  // Relative path — resolve against monorepo root
  // From packages/db/src/sqlite.ts, repo root is ../../..
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(moduleDir, "../../..");
  const absolutePath = resolve(repoRoot, pathPart);
  return pathToFileURL(absolutePath).href;
}

/**
 * Create a libsql-backed Drizzle database (SQLite local file or Turso remote).
 *
 * On Cloudflare Workers a fresh client is created per call; in Node the
 * instance is cached when `singleton` is enabled.
 */
export function createSqliteDb(config: DbConfig): Database {
  let { url, authToken } = config;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  // Resolve relative file: URLs to absolute paths
  url = resolveFileUrl(url);

  const clientConfig = authToken ? { url, authToken } : { url };

  if (isCloudflareWorker) {
    return drizzle({ client: createClient(clientConfig), schema });
  }

  if (config.singleton) {
    if (!sqliteDbInstance) {
      sqliteDbInstance = drizzle({ client: createClient(clientConfig), schema });
    }
    return sqliteDbInstance;
  }

  return drizzle({ client: createClient(clientConfig), schema });
}
