import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configs: {} as Record<string, string | undefined>,
}));

vi.mock("@openstarter/shared/config", () => ({
  getAllConfigs: async () => state.configs,
}));

import { getAdapter, getAvailableProviders, resolveAdapterSpec } from "./provider";

type Configs = Awaited<ReturnType<typeof import("@openstarter/shared/config").getAllConfigs>>;

const cfg = (overrides: Record<string, string | undefined> = {}) => overrides as Configs;

describe("resolveAdapterSpec", () => {
  it("openai：显式密钥 + max_tokens（Chat Completions 端点）", () => {
    const spec = resolveAdapterSpec("openai", "gpt-4o-mini", cfg({ openai_api_key: "sk-test" }));
    expect(spec).toMatchObject({
      kind: "openai",
      model: "gpt-4o-mini",
      apiKey: "sk-test",
      maxTokensKey: "max_tokens",
    });
  });

  it("openai：缺密钥抛 not configured", () => {
    expect(() => resolveAdapterSpec("openai", "gpt-4o-mini", cfg())).toThrow(/not configured/);
  });

  it("缺 provider 时取 default_llm_provider，缺 model 时用 gpt-4o-mini", () => {
    const spec = resolveAdapterSpec(
      undefined,
      undefined,
      cfg({
        default_llm_provider: "anthropic",
        anthropic_api_key: "sk-ant",
      }),
    );
    expect(spec).toMatchObject({
      kind: "anthropic",
      model: "gpt-4o-mini",
      maxTokensKey: "max_tokens",
    });
  });

  it("google → gemini，maxOutputTokens", () => {
    const spec = resolveAdapterSpec("google", "gemini-2.5-flash", cfg({ google_api_key: "g-key" }));
    expect(spec).toMatchObject({ kind: "gemini", maxTokensKey: "maxOutputTokens" });
  });

  it("openrouter → compat：默认 baseURL + 配置密钥", () => {
    const spec = resolveAdapterSpec(
      "openrouter",
      "anthropic/claude",
      cfg({ openrouter_api_key: "or-key" }),
    );
    expect(spec).toMatchObject({
      kind: "compat",
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: "or-key",
      maxTokensKey: "max_tokens",
    });
  });

  it("deepseek 缺密钥抛错；ollama 用占位密钥与自定义 baseURL", () => {
    expect(() => resolveAdapterSpec("deepseek", "deepseek-chat", cfg())).toThrow(/not configured/);
    const spec = resolveAdapterSpec(
      "ollama",
      "mistral:7b",
      cfg({ ollama_base_url: "http://gpu:11434/v1" }),
    );
    expect(spec).toMatchObject({
      kind: "compat",
      name: "ollama",
      baseURL: "http://gpu:11434/v1",
      apiKey: "ollama",
    });
  });

  it("ollama 未配置 baseURL 抛错", () => {
    expect(() => resolveAdapterSpec("ollama", "mistral:7b", cfg())).toThrow(
      /base URL not configured/,
    );
  });

  it("newapi → compat：自托管 baseURL + 配置密钥", () => {
    const spec = resolveAdapterSpec(
      "newapi",
      "gpt-4o",
      cfg({
        newapi_base_url: "https://newapi.example.com/v1",
        newapi_api_key: "sk-newapi",
      }),
    );
    expect(spec).toMatchObject({
      kind: "compat",
      name: "newapi",
      baseURL: "https://newapi.example.com/v1",
      apiKey: "sk-newapi",
      maxTokensKey: "max_tokens",
    });
  });

  it("newapi 缺 baseURL 或密钥分别抛错", () => {
    expect(() =>
      resolveAdapterSpec("newapi", "gpt-4o", cfg({ newapi_api_key: "sk-newapi" })),
    ).toThrow(/base URL not configured/);
    expect(() =>
      resolveAdapterSpec(
        "newapi",
        "gpt-4o",
        cfg({ newapi_base_url: "https://newapi.example.com/v1" }),
      ),
    ).toThrow(/not configured/);
  });

  it("未知 provider 抛 Unknown LLM provider", () => {
    expect(() => resolveAdapterSpec("nope", "m", cfg())).toThrow(/Unknown LLM provider/);
  });
});

describe("getAvailableProviders", () => {
  it("newapi 需要 base_url + api_key 同时存在", async () => {
    state.configs = { newapi_base_url: "https://newapi.example.com/v1" };
    expect(await getAvailableProviders()).not.toContain("newapi");

    state.configs = {
      newapi_base_url: "https://newapi.example.com/v1",
      newapi_api_key: "sk-newapi",
    };
    expect(await getAvailableProviders()).toContain("newapi");
  });
});

describe("getAdapter", () => {
  it("各供应商均返回 adapter 实例与 maxTokensKey（冒烟）", async () => {
    state.configs = {
      openai_api_key: "k",
      anthropic_api_key: "k",
      google_api_key: "k",
      openrouter_api_key: "k",
    };
    for (const [provider, model] of [
      ["openai", "gpt-4o-mini"],
      ["anthropic", "claude-sonnet-4-5"],
      ["google", "gemini-2.5-flash"],
      ["openrouter", "anthropic/claude"],
    ] as const) {
      const { adapter, maxTokensKey } = await getAdapter(provider, model);
      expect(adapter).toBeTruthy();
      expect(typeof maxTokensKey).toBe("string");
    }
  });
});
