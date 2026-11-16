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
