import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { isCloudflareWorker, readCloudflareEnv } from "../utils/runtime";
import type { Database, DbConfig } from "../types";

let postgresDbInstance: Database | null = null;
let postgresClient: ReturnType<typeof postgres> | null = null;

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
    return drizzle({ client: workerClient }) as unknown as Database;
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
      postgresDbInstance = drizzle({ client: postgresClient }) as unknown as Database;
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
  return drizzle({ client: serverlessClient }) as unknown as Database;
}

export async function closePostgresDb(): Promise<void> {
  if (postgresClient) {
    await postgresClient.end();
    postgresClient = null;
    postgresDbInstance = null;
  }
}
