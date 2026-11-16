function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name} for the production drizzle-kit config.`,
    );
  }
  return value;
}

export default {
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations/sqlite",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
    databaseId: requireEnv("CLOUDFLARE_DATABASE_ID"),
    token: requireEnv("CLOUDFLARE_API_TOKEN"),
  },
} as const;
