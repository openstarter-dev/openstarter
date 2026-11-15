// Load apps/web/.env (cwd) into process.env for the Node runtime (dev SSR,
// self-hosted Node); no-op on Cloudflare Workers where env comes from bindings.
try {
  process.loadEnvFile();
} catch {
  // .env missing or runtime without fs (Workers) — env must come from the real environment.
}

import { createClient } from "@libsql/client";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { type LibSQLDatabase, drizzle as drizzleLibsql } from "drizzle-orm/libsql";

import { repoRoot, resolveFileUrl } from "../drizzle.shared";
import * as schema from "./schema";
import { withSqliteCompat } from "./sqlite-compat";

// The libsql-typed drizzle view is the shared Database type: local dev runs libsql directly,
// and the D1 driver is cast into it so every consumer sees one identical query-builder type.
// 统一以 libsql 视角作为 Database 类型：本地开发直连 libsql，D1 驱动运行时转型，消费方类型完全一致。
export type Database = LibSQLDatabase<typeof schema>;

type DbConfig = {
  url: string;
};

// ─── Cloudflare runtime detection（原 utils/runtime.ts，仅此处使用） ──────────

type CloudflareGlobal = {
  navigator?: { userAgent?: string };
  Cloudflare?: unknown;
};

const cloudflareGlobal = globalThis as CloudflareGlobal;

const isCloudflareWorker =
  cloudflareGlobal.navigator?.userAgent === "Cloudflare-Workers" || "Cloudflare" in globalThis;

type CloudflareEnv = {
  DB?: unknown;
};

function readCloudflareEnv(): CloudflareEnv | undefined {
  const scope = globalThis as {
    __CF_ENV__?: CloudflareEnv;
    __env__?: CloudflareEnv;
  };
  return scope.__CF_ENV__ ?? scope.__env__;
}

// ─── D1 binding identity cache（原 drivers/d1.ts） ───────────────────────────

type D1Binding = {
  prepare(query: string): unknown;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
  dump(): Promise<ArrayBuffer>;
};

let cachedInstance: Database | null = null;
// Track the active D1 binding reference so Workers reloads never reuse a stale binding
// 记录当前 D1 binding 引用，避免 Workers 环境下跨请求复用旧实例
let cachedBinding: D1Binding | null = null;

const LOCAL_D1_FILE_URL = "file:local.db";

function resolveLocalD1Url(configured: string | undefined): string {
  const raw = configured?.trim();
  if (raw === ":memory:") {
    return raw;
  }
  const url = raw?.startsWith("file:") ? raw : LOCAL_D1_FILE_URL;
  return resolveFileUrl(url, repoRoot);
}

function createDb(config: DbConfig): Database {
  const binding = readCloudflareEnv()?.DB as D1Binding | undefined;

  if (!binding) {
    if (isCloudflareWorker) {
      throw new Error(
        'D1 binding "DB" not found. The db package only supports Cloudflare Workers with a d1_databases binding named "DB".',
      );
    }

    if (cachedInstance && cachedBinding === null) {
      return cachedInstance;
    }

    cachedInstance = withSqliteCompat(
      drizzleLibsql({
        client: createClient({ url: resolveLocalD1Url(config.url) }),
        schema,
      }),
      "sqlite",
    );
    cachedBinding = null;
    return cachedInstance;
  }

  if (cachedInstance && cachedBinding === binding) {
    return cachedInstance;
  }

  const instance = drizzleD1(binding as unknown as Parameters<typeof drizzleD1>[0], {
    schema,
  });
  cachedInstance = withSqliteCompat(instance as unknown as Database, "d1");
  cachedBinding = binding;
  return cachedInstance;
}

// Instance caching above is keyed by the active D1 binding identity so Workers reloads
// never reuse a stale binding; local dev caches the libsql client.
// 实例缓存按当前 D1 binding 身份生效（Workers 热重载不会复用旧实例），本地开发缓存 libsql client。
export function db(): Database {
  return createDb({ url: process.env.DATABASE_URL?.trim() ?? "" });
}
