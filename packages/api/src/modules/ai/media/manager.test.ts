import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAIManager, setSaveFiles } from "./manager";

describe("getAIManager — New API 装配", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    setSaveFiles(async () => []);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("NEWAPI_BASE_URL + NEWAPI_API_KEY 齐备时注册 newapi", async () => {
    vi.stubEnv("NEWAPI_BASE_URL", "https://newapi.example.com/v1");
    vi.stubEnv("NEWAPI_API_KEY", "sk-newapi");

    const manager = await getAIManager();
    expect(manager.getProviderNames()).toContain("newapi");
    expect(manager.getProvider("newapi")?.name).toBe("newapi");
  });

  it("缺少 NEWAPI_API_KEY 时不注册", async () => {
    vi.stubEnv("NEWAPI_BASE_URL", "https://newapi.example.com/v1");
    const manager = await getAIManager();
    expect(manager.getProviderNames()).not.toContain("newapi");
  });

  it("NEWAPI_ENABLED=false 时不注册", async () => {
    vi.stubEnv("NEWAPI_BASE_URL", "https://newapi.example.com/v1");
    vi.stubEnv("NEWAPI_API_KEY", "sk-newapi");
    vi.stubEnv("NEWAPI_ENABLED", "false");
    const manager = await getAIManager();
    expect(manager.getProviderNames()).not.toContain("newapi");
  });

  it("DEFAULT_AI_PROVIDER=newapi 时作为默认渠道", async () => {
    vi.stubEnv("DEFAULT_AI_PROVIDER", "newapi");
    vi.stubEnv("NEWAPI_BASE_URL", "https://newapi.example.com/v1");
    vi.stubEnv("NEWAPI_API_KEY", "sk-newapi");
    const manager = await getAIManager();
    expect(manager.getDefaultProvider()?.name).toBe("newapi");
  });
});
