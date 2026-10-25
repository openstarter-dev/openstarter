// packages/api/src/ai/manager —— 按 Config 装配供应商的回归测试。
//
// 重点覆盖 New API 中转站：base_url + api_key 齐备才注册；`newapi_enabled=false` 可关闭；
// `default_ai_provider=newapi` 时作为默认渠道。setSaveFiles 同时用于清空模块级缓存。

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ configs: {} as Record<string, string> }));

vi.mock("@openstarter/shared/config", () => ({
  getAllConfigs: async () => state.configs,
}));

import { getAIManager, setSaveFiles } from "./manager";

describe("getAIManager — New API 装配", () => {
  beforeEach(() => {
    state.configs = {};
    // 清空管理器缓存（setSaveFiles 会重置 cachedManager / cachedHash）。
    setSaveFiles(async () => []);
  });

  it("base_url + api_key 齐备时注册 newapi", async () => {
    state.configs = {
      newapi_base_url: "https://newapi.example.com/v1",
      newapi_api_key: "sk-newapi",
    };

    const manager = await getAIManager();
    expect(manager.getProviderNames()).toContain("newapi");
    expect(manager.getProvider("newapi")?.name).toBe("newapi");
  });

  it("缺少 api_key 时不注册", async () => {
    state.configs = { newapi_base_url: "https://newapi.example.com/v1" };
    const manager = await getAIManager();
    expect(manager.getProviderNames()).not.toContain("newapi");
  });

  it("newapi_enabled=false 时不注册", async () => {
    state.configs = {
      newapi_base_url: "https://newapi.example.com/v1",
      newapi_api_key: "sk-newapi",
      newapi_enabled: "false",
    };
    const manager = await getAIManager();
    expect(manager.getProviderNames()).not.toContain("newapi");
  });

  it("default_ai_provider=newapi 时作为默认渠道", async () => {
    state.configs = {
      default_ai_provider: "newapi",
      newapi_base_url: "https://newapi.example.com/v1",
      newapi_api_key: "sk-newapi",
    };
    const manager = await getAIManager();
    expect(manager.getDefaultProvider()?.name).toBe("newapi");
  });
});
