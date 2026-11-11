import { createClient } from "@libsql/client";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";

import { repoRoot, resolveFileUrl } from "../config/resolve-file-url";
import * as schema from "../schema";
import type { Database, DbConfig } from "../types";
import { isCloudflareWorker, readCloudflareEnv } from "../utils/runtime";

// D1 singleton (safe to cache: the binding is request-scoped by the runtime).
let d1DbInstance: Database | null = null;

// Minimal structural shape of a D1 binding — avoids depending on
// `@cloudflare/workers-types`, which is not in this package's `types`.
type D1Binding = {
  prepare(query: string): unknown;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
  dump(): Promise<ArrayBuffer>;
};

/**
 * Local sqlite file used when `DATABASE_PROVIDER=d1` runs outside Cloudflare
 * Workers (`pnpm dev`, node server, tests). D1 is sqlite-flavored, so the local
 * stand-in runs the exact same schema and migrations against a file database.
 *
 * Mirrors the `d1` branch of `drizzle.config.ts`: relative `file:` URLs resolve
 * against the monorepo root, and a non-`file:` URL (e.g. a leftover postgres
 * connection string) falls back to `local.db`.
 */
const LOCAL_D1_FILE_URL = "file:local.db";

function resolveLocalD1Url(configured: string | undefined): string {
  const raw = configured?.trim();
  if (raw === ":memory:") {
    return raw;
  }
  const url = raw?.startsWith("file:") ? raw : LOCAL_D1_FILE_URL;
  return resolveFileUrl(url, repoRoot);
}

/**
 * Create a D1-backed Drizzle database.
 *
 * - Cloudflare Workers: uses the `DB` d1_databases binding.
 * - Node / local dev: falls back to the local sqlite file (`local.db`) so the
 *   default `DATABASE_PROVIDER=d1` works without a Workers runtime.
 */
export function createD1Db(config: DbConfig): Database {
  if (d1DbInstance) {
    return d1DbInstance;
  }

  const binding = readCloudflareEnv()?.DB as D1Binding | undefined;

  if (!binding) {
    if (isCloudflareWorker) {
      throw new Error(
        'D1 binding "DB" not found. DATABASE_PROVIDER=d1 only works on Cloudflare Workers with a d1_databases binding named "DB".',
      );
    }

    d1DbInstance = drizzleLibsql({
      client: createClient({ url: resolveLocalD1Url(config.url) }),
      schema,
    }) as unknown as Database;
    return d1DbInstance;
  }

  const instance = drizzleD1(binding as unknown as Parameters<typeof drizzleD1>[0], {
    schema,
  });
  d1DbInstance = instance as unknown as Database;
  return d1DbInstance;
}
