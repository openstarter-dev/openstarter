import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../schema";
import { isCloudflareWorker, readCloudflareEnv } from "../utils/runtime";
import type { Database, DbConfig } from "../types";

let postgresDbInstance: Database | null = null;
let postgresClient: ReturnType<typeof postgres> | null = null;

/**
 * Bind schema so Drizzle relational queries (`db().query.*`) work in Postgres mode.
 * 绑定 schema 以确保 Postgres 模式下 Drizzle 关联查询可用。
 */
function createDrizzlePostgres(client: ReturnType<typeof postgres>): Database {
  return drizzle({ client, schema }) as unknown as Database;
}

export function createPostgresDb(config: DbConfig): Database {
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

  const schemaName = (config.schema ?? "public").trim();
  const connectionOptions =
    schemaName && schemaName !== "public"
      ? { connection: { options: `-c search_path=${schemaName}` } }
      : {};

  if (isCloudflareWorker) {
    const workerClient = postgres(url, {
      prepare: false,
      max: 1,
      idle_timeout: 10,
      connect_timeout: 5,
      ...connectionOptions,
    });
    return createDrizzlePostgres(workerClient);
  }

  if (config.singleton) {
    if (!postgresDbInstance) {
      postgresClient = postgres(url, {
        prepare: false,
        max: config.maxConnections ?? 1,
        idle_timeout: 30,
        connect_timeout: 10,
        ...connectionOptions,
      });
      postgresDbInstance = createDrizzlePostgres(postgresClient);
    }
    return postgresDbInstance;
  }

  const serverlessClient = postgres(url, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ...connectionOptions,
  });
  return createDrizzlePostgres(serverlessClient);
}

export async function closePostgresDb(): Promise<void> {
  if (postgresClient) {
    await postgresClient.end();
    postgresClient = null;
    postgresDbInstance = null;
  }
}
