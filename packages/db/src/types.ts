import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

export type DbProvider = "postgres" | "d1";

export type Database = LibSQLDatabase<typeof schema>;

export type DbConfig = {
  provider: string;
  url: string;
  schema?: string;
  singleton?: boolean;
  maxConnections?: number;
};
