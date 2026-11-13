import { createDb } from "./factory/create-db";
import { env } from "./config/env";
import { isCloudflareWorker } from "./utils/runtime";
import type { Database, DbConfig } from "./types";

const TCP_PROVIDERS = new Set(["postgres"]);

let cachedDb: Database | null = null;

function resolveDbConfigFromEnv(): DbConfig {
  return {
    provider: env.DATABASE_PROVIDER,
    url: env.DATABASE_URL,
    schema: env.DB_SCHEMA,
    singleton: env.DB_SINGLETON_ENABLED === "true",
    maxConnections: Number(env.DB_MAX_CONNECTIONS) || 1,
  };
}

export function db(): Database {
  if (cachedDb) {
    return cachedDb;
  }

  const config = resolveDbConfigFromEnv();
  const instance = createDb(config);

  if (!(isCloudflareWorker && TCP_PROVIDERS.has(config.provider))) {
    cachedDb = instance;
  }

  return instance;
}

export { getAuthAdapterProvider } from "./config/adapter";
export type { AuthAdapterProvider } from "./config/adapter";
export { closeDb, createDb } from "./factory/create-db";
export type { Database, DbConfig, DbProvider } from "./types";
