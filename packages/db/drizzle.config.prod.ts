import { loadWebEnv } from "./drizzle.shared";

loadWebEnv();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name} for the production drizzle-kit config.`,
    );
  }
  return value;
}

// Production D1 migrations run over the d1-http driver; credentials come from CI.
export default {
  schema: "./src/schema/index.ts",
  out: "./src/migrations/sqlite",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
    databaseId: requireEnv("CLOUDFLARE_DATABASE_ID"),
    token: requireEnv("CLOUDFLARE_API_TOKEN"),
  },
} as const;
