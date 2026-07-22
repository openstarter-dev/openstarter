import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";

import { isCloudflareWorker, readCloudflareEnv } from "./runtime";
import type { Database, DbConfig } from "./types";

// mysql2 pool singleton (Node only).
let mysqlDbInstance: Database | null = null;
let mysqlPool: ReturnType<typeof mysql.createPool> | null = null;

/**
 * Create a mysql2-backed Drizzle database.
 *
 * On Cloudflare Workers a fresh connection is created per call (workerd forbids
 * reusing TCP sockets across requests); a Hyperdrive binding is preferred when
 * present. In Node a pool is cached when `singleton` is enabled.
 */
export function createMysqlDb(config: DbConfig): Database {
  let url = config.url;

  if (isCloudflareWorker) {
    const hyperdrive = readCloudflareEnv()?.HYPERDRIVE;
    if (hyperdrive?.connectionString) {
      url = hyperdrive.connectionString;
    }
  }

  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  if (isCloudflareWorker) {
    const workerClient = mysql.createConnection(url);
    return drizzle({ client: workerClient }) as unknown as Database;
  }

  if (config.singleton) {
    if (!mysqlDbInstance) {
      mysqlPool = mysql.createPool({
        uri: url,
        connectionLimit: config.maxConnections ?? 1,
        enableKeepAlive: true,
        waitForConnections: true,
      });
      mysqlDbInstance = drizzle({ client: mysqlPool }) as unknown as Database;
    }
    return mysqlDbInstance;
  }

  const serverlessClient = mysql.createConnection(url);
  return drizzle({ client: serverlessClient }) as unknown as Database;
}

/** Close the cached mysql2 pool (singleton mode). */
export async function closeMysqlDb(): Promise<void> {
  if (mysqlPool) {
    await mysqlPool.end();
    mysqlPool = null;
    mysqlDbInstance = null;
  }
}
