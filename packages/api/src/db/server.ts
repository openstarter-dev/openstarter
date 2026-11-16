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

export function db(): Database {
  return createDb();
}

export function d1Transaction<T>(
  database: Database,
  callback: (tx: Database) => Promise<T>,
): Promise<T> {
  return callback(database);
}
