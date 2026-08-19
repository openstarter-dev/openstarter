import { drizzle } from "drizzle-orm/d1";

import { readCloudflareEnv } from "../utils/runtime";
import * as schema from "../schema";
import type { Database } from "../types";

// D1 singleton (safe to cache: the binding is request-scoped by the runtime).
let d1DbInstance: Database | null = null;

// Minimal structural shape of a D1 binding — avoids depending on
// `@cloudflare/workers-types`, which is not in this package's `types`.
type D1Binding = {
  prepare(query: string): unknown;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
  dump(): Promise<ArrayBuffer>;
};

function getD1Binding(): D1Binding {
  const binding = readCloudflareEnv()?.DB;
  if (!binding) {
    throw new Error(
      'D1 binding "DB" not found. DATABASE_PROVIDER=d1 only works on Cloudflare Workers with a d1_databases binding named "DB".',
    );
  }
  return binding as D1Binding;
}

/** Create a Cloudflare D1-backed Drizzle database from the `DB` binding. */
export function createD1Db(): Database {
  if (d1DbInstance) {
    return d1DbInstance;
  }

  const binding = getD1Binding();
  const instance = drizzle(binding as unknown as Parameters<typeof drizzle>[0], {
    schema,
  });
  d1DbInstance = instance as unknown as Database;
  return d1DbInstance;
}
