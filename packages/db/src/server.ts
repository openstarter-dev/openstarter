import { createDb } from "./factory/create-db";
import { env } from "./config/env";
import type { Database, DbConfig } from "./types";

function resolveDbConfigFromEnv(): DbConfig {
  return {
    url: env.DATABASE_URL,
  };
}

// Instance caching lives in drivers/d1.ts, keyed by the active D1 binding identity so
// Workers reloads never reuse a stale binding; local dev caches the libsql client.
// 实例缓存收敛在 drivers/d1.ts：按当前 D1 binding 身份缓存（Workers 热重载不会复用旧实例），本地开发缓存 libsql client。
export function db(): Database {
  return createDb(resolveDbConfigFromEnv());
}

export { createDb } from "./factory/create-db";
export type { Database, DbConfig, DbProvider } from "./types";
