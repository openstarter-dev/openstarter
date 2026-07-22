import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().default("file:data/local.db"),
  DATABASE_PROVIDER: z.string().default("sqlite"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  DB_SCHEMA: z.string().default("public"),
  DB_SINGLETON_ENABLED: z.string().default("false"),
  DB_MAX_CONNECTIONS: z.string().default("1"),
});

export const env = schema.parse(process.env);
