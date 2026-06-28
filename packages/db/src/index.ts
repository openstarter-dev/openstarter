import { createClient } from "@libsql/client";
import { env } from "@openstarter/env/server";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

export function createDb() {
  const client = createClient({
    url: env.DATABASE_URL || "",
  });

  return drizzle({ client, schema });
}
