/**
 * Server-only entry point (`@openstarter/db/server`).
 *
 * Central re-export hub for server-side database access: the connection
 * factory, the `db()` singleton accessor and the related types. Additional
 * server-only exports (e.g. the better-auth adapter provider mapping) are
 * appended to the re-export block below.
 */

import { createDb } from "./factory/create-db";
import { env } from "./config/env";
import { isCloudflareWorker } from "./utils/runtime";
import type { Database, DbConfig } from "./types";

// workerd forbids reusing TCP sockets across requests, so TCP-backed drivers
// (postgres/mysql) must not be cached there — a fresh client is created per
// call. The D1 binding and local Node drivers are safe to cache.
const TCP_PROVIDERS = new Set(["postgres", "mysql"]);

let cachedDb: Database | null = null;

function resolveDbConfigFromEnv(): DbConfig {
  return {
    provider: env.DATABASE_PROVIDER,
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN,
    schema: env.DB_SCHEMA,
    singleton: env.DB_SINGLETON_ENABLED === "true",
    maxConnections: Number(env.DB_MAX_CONNECTIONS) || 1,
  };
}

/**
 * Singleton database accessor. Caches the instance in Node; on Cloudflare
 * Workers the instance is not cached for TCP-backed drivers (postgres/mysql).
 */
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
