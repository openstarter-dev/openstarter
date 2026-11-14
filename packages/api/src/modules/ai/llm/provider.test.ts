import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAdapter, getAvailableProviders, type LlmEnvConfig, resolveAdapterSpec } from "./provider";

const cfg = (overrides: LlmEnvConfig = {}): LlmEnvConfig => overrides;

describe("resolveAdapterSpec", () => {
  it("openai：显式密钥 + max_tokens（Chat Completions 端点）", () => {
    const spec = resolveAdapterSpec("openai", "gpt-4o-mini", cfg({ OPENAI_API_KEY: "sk-test" }));
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

  it("缺 provider 时取 DEFAULT_LLM_PROVIDER，缺 model 时用 gpt-4o-mini", () => {
    const spec = resolveAdapterSpec(
      undefined,
      undefined,
      cfg({
        DEFAULT_LLM_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "sk-ant",
      }),
    );
    expect(spec).toMatchObject({
      kind: "anthropic",
      model: "gpt-4o-mini",
      maxTokensKey: "max_tokens",
    });
  });

  it("google → gemini，maxOutputTokens", () => {
    const spec = resolveAdapterSpec("google", "gemini-2.5-flash", cfg({ GOOGLE_API_KEY: "g-key" }));
    expect(spec).toMatchObject({ kind: "gemini", maxTokensKey: "maxOutputTokens" });
  });

  it("openrouter → compat：默认 baseURL + 配置密钥", () => {
    const spec = resolveAdapterSpec(
      "openrouter",
      "anthropic/claude",
      cfg({ OPENROUTER_API_KEY: "or-key" }),
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
      cfg({ OLLAMA_BASE_URL: "http://gpu:11434/v1" }),
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
        NEWAPI_BASE_URL: "https://newapi.example.com/v1",
        NEWAPI_API_KEY: "sk-newapi",
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
      resolveAdapterSpec("newapi", "gpt-4o", cfg({ NEWAPI_API_KEY: "sk-newapi" })),
    ).toThrow(/base URL not configured/);
    expect(() =>
      resolveAdapterSpec(
        "newapi",
        "gpt-4o",
        cfg({ NEWAPI_BASE_URL: "https://newapi.example.com/v1" }),
      ),
    ).toThrow(/not configured/);
  });

  it("未知 provider 抛 Unknown LLM provider", () => {
    expect(() => resolveAdapterSpec("nope", "m", cfg())).toThrow(/Unknown LLM provider/);
  });
});

describe("getAvailableProviders", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("newapi 需要 base_url + api_key 同时存在", async () => {
    vi.stubEnv("NEWAPI_BASE_URL", "https://newapi.example.com/v1");
    expect(await getAvailableProviders()).not.toContain("newapi");

    vi.stubEnv("NEWAPI_API_KEY", "sk-newapi");
    expect(await getAvailableProviders()).toContain("newapi");
  });
});

describe("getAdapter", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("各供应商均返回 adapter 实例与 maxTokensKey（冒烟）", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    vi.stubEnv("GOOGLE_API_KEY", "k");
    vi.stubEnv("OPENROUTER_API_KEY", "k");
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
