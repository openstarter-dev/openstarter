import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";

import { env } from "../lib/env";
import * as schema from "./schema";

export type Database = DrizzleD1Database<typeof schema>;

type D1Binding = {
  prepare(query: string): unknown;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
  dump(): Promise<ArrayBuffer>;
};

let cachedInstance: Database | null = null;
let cachedBinding: D1Binding | null = null;

function createDb(): Database {
  const binding = env.DB as D1Binding | undefined;

  if (!binding) {
    throw new Error(
      'D1 binding "DB" not found in the Workers env. Cloudflare Workers require a d1_databases binding named "DB" (wrangler.jsonc); pure Node scripts should build their own local D1 via createLocalDatabase() from src/db/local.ts.',
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
