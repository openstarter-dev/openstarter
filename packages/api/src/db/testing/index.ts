// Test database factory backed by a REAL D1 binding: each call spins up an
// in-memory miniflare D1 (the same engine/API as production) and hands the
// binding to Drizzle's D1 driver. Dispose with disposeSqliteTestDb.
// 测试数据库工厂：每次调用起一个内存态 miniflare D1（与生产同引擎同 API），
// binding 交给 drizzle 的 D1 驱动；用完 disposeSqliteTestDb 释放。
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";

import * as schema from "../schema";
import type { Database } from "../server";

const TEST_WORKER_SCRIPT = "export default { fetch: () => new Response(null) }";

const miniflareByDatabase = new WeakMap<object, Miniflare>();

export async function createSqliteTestDb(): Promise<Database> {
  const miniflare = new Miniflare({
    modules: true,
    script: TEST_WORKER_SCRIPT,
    d1Databases: ["DB"],
  });

  const binding = await miniflare.getD1Database("DB");
  const database = drizzle(binding, { schema });
  miniflareByDatabase.set(database, miniflare);
  return database;
}

export async function disposeSqliteTestDb(database: Database): Promise<void> {
  const miniflare = miniflareByDatabase.get(database);
  if (miniflare) {
    miniflareByDatabase.delete(database);
    await miniflare.dispose();
  }
}
