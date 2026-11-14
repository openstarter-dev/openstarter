import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("drizzle.config.prod", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the D1 d1-http driver when credentials are present", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubEnv("CLOUDFLARE_DATABASE_ID", "dbid");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");

    const { default: config } = await import("../../drizzle.config.prod");
    expect(config).toMatchObject({ dialect: "sqlite", driver: "d1-http" });
  });

  it("throws a clear error when D1 credentials are missing", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    vi.stubEnv("CLOUDFLARE_DATABASE_ID", "");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");

    await expect(import("../../drizzle.config.prod")).rejects.toThrow(/CLOUDFLARE_ACCOUNT_ID/);
  });
});
