import { createClient } from "@libsql/client";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";

import { repoRoot, resolveFileUrl } from "../config/resolve-file-url";
import * as schema from "../schema";
import type { Database, DbConfig } from "../types";
import { isCloudflareWorker, readCloudflareEnv } from "../utils/runtime";

let d1DbInstance: Database | null = null;
// Track the active D1 binding reference so Workers reloads never reuse a stale binding
// 记录当前 D1 binding 引用，避免 Workers 环境下跨请求复用旧实例
let cachedD1Binding: D1Binding | null = null;

type D1Binding = {
  prepare(query: string): unknown;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
  dump(): Promise<ArrayBuffer>;
};

const LOCAL_D1_FILE_URL = "file:local.db";

function resolveLocalD1Url(configured: string | undefined): string {
  const raw = configured?.trim();
  if (raw === ":memory:") {
    return raw;
  }
  const url = raw?.startsWith("file:") ? raw : LOCAL_D1_FILE_URL;
  return resolveFileUrl(url, repoRoot);
}

export function createD1Db(config: DbConfig): Database {
  const binding = readCloudflareEnv()?.DB as D1Binding | undefined;

  if (!binding) {
    if (isCloudflareWorker) {
      throw new Error(
        'D1 binding "DB" not found. DATABASE_PROVIDER=d1 only works on Cloudflare Workers with a d1_databases binding named "DB".',
      );
    }

    if (d1DbInstance && cachedD1Binding === null) {
      return d1DbInstance;
    }

    d1DbInstance = drizzleLibsql({
      client: createClient({ url: resolveLocalD1Url(config.url) }),
      schema,
    }) as unknown as Database;
    cachedD1Binding = null;
    return d1DbInstance;
  }

  if (d1DbInstance && cachedD1Binding === binding) {
    return d1DbInstance;
  }

  const instance = drizzleD1(binding as unknown as Parameters<typeof drizzleD1>[0], {
    schema,
  });
  d1DbInstance = instance as unknown as Database;
  cachedD1Binding = binding;
  return d1DbInstance;
}
