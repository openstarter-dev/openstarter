import "dotenv/config";

import { buildConfigFor, resolveDbUrl, resolveDialect } from "./src/config/drizzle.shared";


const provider = process.env.DATABASE_PROVIDER?.trim() || "d1";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name} for the production drizzle-kit config (provider: ${provider}).`,
    );
  }
  return value;
}

function d1Config(): ReturnType<typeof buildConfigFor> {
  return {
    schema: "./src/schema/index.ts",
    out: "./src/migrations/sqlite",
    dialect: "sqlite",
    driver: "d1-http",
    dbCredentials: {
      accountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
      databaseId: requireEnv("CLOUDFLARE_DATABASE_ID"),
      token: requireEnv("CLOUDFLARE_API_TOKEN"),
    },
  } as ReturnType<typeof buildConfigFor>;
}

const config =
  provider === "d1"
    ? d1Config()
    : buildConfigFor(resolveDialect(provider), resolveDbUrl(requireEnv("DATABASE_URL")));

export default config;
