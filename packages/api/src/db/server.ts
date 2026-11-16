import { type AnyD1Database, type DrizzleD1Database, drizzle } from "drizzle-orm/d1";

import { env } from "../lib/env";
import * as schema from "./schema";

export type Database = DrizzleD1Database<typeof schema>;

let cachedInstance: Database | null = null;
let cachedBinding: AnyD1Database | null = null;

export function db(): Database {
  const binding = env.DB as AnyD1Database | undefined;

  if (!binding) {
    throw new Error(
      'D1 binding "DB" not found in the Workers env. Cloudflare Workers require a d1_databases binding named "DB" (wrangler.jsonc).',
    );
  }

  if (cachedInstance && cachedBinding === binding) {
    return cachedInstance;
  }

  cachedInstance = drizzle(binding, { schema });
  cachedBinding = binding;
  return cachedInstance;
}

export function d1Transaction<T>(
  database: Database,
  callback: (tx: Database) => Promise<T>,
): Promise<T> {
  return callback(database);
}
