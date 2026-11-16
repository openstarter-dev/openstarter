// Self-wiring the Cloudflare env: in workerd (dev via @cloudflare/vite-plugin and
// deployed Workers alike) the official `cloudflare:workers` module exposes the
// request env at module scope — grab it here so EVERY consumer (auth's top-level
// db() included) sees the binding regardless of import order. On Node runtimes
// the module does not exist: initLocalD1() (src/db/local, used by seed-admin) or
// the test harness supplies the binding instead. The dynamic import lives in
// cloudflare-env.mjs (see its header for why).
// 自接线 Cloudflare env：workerd（dev 插件与线上）里官方 cloudflare:workers 模块在
// 模块作用域暴露 env，在此处统一捕获，任何消费方（含 auth 顶层 db()）不依赖入口
// 的 import 顺序。Node 侧无该模块，由 initLocalD1()（seed-admin 用）或测试基建提供。
// 动态 import 放在 cloudflare-env.mjs（原因见其文件头注释）。
const cloudflareEnv = await tryGetCloudflareEnv();
if (cloudflareEnv) {
  (globalThis as unknown as { __CF_ENV__?: unknown }).__CF_ENV__ = cloudflareEnv;
}

import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";

import { tryGetCloudflareEnv } from "./cloudflare-env.mjs";
import * as schema from "./schema";

export type Database = DrizzleD1Database<typeof schema>;

type D1Binding = {
  prepare(query: string): unknown;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
  dump(): Promise<ArrayBuffer>;
};

type CloudflareEnv = {
  DB?: unknown;
};

function readCloudflareEnv(): CloudflareEnv | undefined {
  return (globalThis as { __CF_ENV__?: CloudflareEnv }).__CF_ENV__;
}

let cachedInstance: Database | null = null;
let cachedBinding: D1Binding | null = null;

function createDb(): Database {
  const binding = readCloudflareEnv()?.DB as D1Binding | undefined;

  if (!binding) {
    throw new Error(
      'D1 binding "DB" not found. Node runtimes (seed scripts) must call initLocalD1() from "../local" (src/db/local.ts) before importing the db server module; Cloudflare Workers require a d1_databases binding named "DB".',
    );
  }

  if (cachedInstance && cachedBinding === binding) {
    return cachedInstance;
  }

  cachedInstance = drizzle(binding as unknown as Parameters<typeof drizzle>[0], { schema });
  cachedBinding = binding;
  return cachedInstance;
}

// Instance caching is keyed by the active D1 binding identity so Workers reloads
// never reuse a stale binding.
// 实例缓存按当前 D1 binding 身份生效（Workers 热重载不会复用旧实例）。
export function db(): Database {
  return createDb();
}

// D1 (and its local miniflare twin) rejects SQL BEGIN/SAVEPOINT, so drizzle's
// native db.transaction() cannot run. batch() is the atomic multi-statement
// primitive; for interactive read-then-write logic use this helper, which runs
// the callback WITHOUT atomicity/rollback — callers must stay idempotent or
// compensate on failure.
// D1 拒绝 BEGIN/SAVEPOINT，drizzle 原生 transaction 不可用；原子多语句用 batch()，
// 交互式读写逻辑用本 helper（无原子性与回滚，调用方须自行保证幂等或补偿）。
export function d1Transaction<T>(
  database: Database,
  callback: (tx: Database) => Promise<T>,
): Promise<T> {
  return callback(database);
}
