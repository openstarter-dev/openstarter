import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

export type DbProvider = "d1";

export type Database = LibSQLDatabase<typeof schema>;

export type DbConfig = {
  url: string;
};
