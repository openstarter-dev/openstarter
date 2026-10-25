/**
 * LLM provider resolution — resolves adapter instances based on
 * application configuration keys.
 *
 * 供应商配置键统一为双引擎共用的 `openai_api_key` 等（不再使用 `llm_*` 前缀），
 * 修复旧实现读取未注册键导致聊天永远不可用的缺陷。OpenRouter/DeepSeek/Ollama
 * 均为 OpenAI 兼容端点，按 baseURL 装配。
 */

import { getAllConfigs } from "@openstarter/shared/config";
import { logger } from "@openstarter/shared/logger";
import { ANTHROPIC_MODELS, createAnthropicChat } from "@tanstack/ai-anthropic";
import { GEMINI_MODELS, createGeminiChat } from "@tanstack/ai-gemini";
import { OPENAI_CHAT_MODELS, createOpenaiChatCompletions } from "@tanstack/ai-openai";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";

const OLLAMA_PLACEHOLDER_KEY = "ollama";

/** OpenAI 兼容渠道清单：baseURL 配置键 → 供应商名；maxTokensKey 为该渠道 max-token 参数名。 */
const OPENAI_COMPATIBLE_PROVIDERS = {
  openrouter: {
    baseURLKey: "openrouter_base_url",
    defaultBaseURL: "https://openrouter.ai/api/v1",
    maxTokensKey: "max_tokens",
  },
  deepseek: {
    baseURLKey: "deepseek_base_url",
    defaultBaseURL: "https://api.deepseek.com/v1",
    maxTokensKey: "max_tokens",
  },
  // Ollama / New API 为自托管地址，必须显式配置（不提供默认域名）。
  ollama: {
    baseURLKey: "ollama_base_url",
    defaultBaseURL: "",
    maxTokensKey: "max_tokens",
  },
  // New API 中转站：自托管地址必须显式配置（无默认域名），一个 key 可路由多个上游模型。
  newapi: {
    baseURLKey: "newapi_base_url",
    defaultBaseURL: "",
    maxTokensKey: "max_tokens",
  },
} as const;

export type OpenAICompatibleProviderName = keyof typeof OPENAI_COMPATIBLE_PROVIDERS;

function isOpenAICompatibleProvider(name: string): name is OpenAICompatibleProviderName {
  return name in OPENAI_COMPATIBLE_PROVIDERS;
}

type Configs = Awaited<ReturnType<typeof getAllConfigs>>;

export type AdapterSpec =
  | { kind: "openai"; model: string; apiKey: string; maxTokensKey: "max_tokens" }
  | { kind: "anthropic"; model: string; apiKey: string; maxTokensKey: "max_tokens" }
  | { kind: "gemini"; model: string; apiKey: string; maxTokensKey: "maxOutputTokens" }
  | {
      kind: "compat";
      name: OpenAICompatibleProviderName;
      model: string;
      baseURL: string;
      apiKey: string;
      maxTokensKey: string;
    };

/** 由配置解析 adapter 装配规格（纯函数）。缺密钥/未知供应商直接抛错。 */
export function resolveAdapterSpec(
  provider: string | undefined,
  modelId: string | undefined,
  configs: Configs,
): AdapterSpec {
  const providerName = provider || configs.default_llm_provider || "openai";
  const model = modelId || "gpt-4o-mini";

  if (providerName === "openai") {
    if (!configs.openai_api_key) throw new Error("OpenAI API key not configured (openai_api_key)");
    return { kind: "openai", model, apiKey: configs.openai_api_key, maxTokensKey: "max_tokens" };
  }
  if (providerName === "anthropic") {
    if (!configs.anthropic_api_key)
      throw new Error("Anthropic API key not configured (anthropic_api_key)");
    return {
      kind: "anthropic",
      model,
      apiKey: configs.anthropic_api_key,
      maxTokensKey: "max_tokens",
    };
  }
  if (providerName === "google") {
    if (!configs.google_api_key) throw new Error("Google API key not configured (google_api_key)");
    return {
      kind: "gemini",
      model,
      apiKey: configs.google_api_key,
      maxTokensKey: "maxOutputTokens",
    };
  }
  if (!isOpenAICompatibleProvider(providerName)) {
    throw new Error(`Unknown LLM provider: ${providerName}`);
  }
  const { baseURLKey, defaultBaseURL, maxTokensKey } = OPENAI_COMPATIBLE_PROVIDERS[providerName];
  const baseURL = configs[baseURLKey] || defaultBaseURL;
  if (!baseURL) {
    throw new Error(`${providerName} base URL not configured (${baseURLKey})`);
  }
  const apiKey =
    providerName === "ollama" ? OLLAMA_PLACEHOLDER_KEY : configs[`${providerName}_api_key`] || "";
  if (providerName !== "ollama" && !apiKey) {
    throw new Error(`${providerName} API key not configured (${providerName}_api_key)`);
  }
  return {
    kind: "compat",
    name: providerName,
    model,
    baseURL,
    apiKey,
    maxTokensKey,
  };
}

/**
 * 模型名来自 DB（可为任意字符串/自定义名），而官方适配器工厂在类型层约束为
 * 已知模型联合 —— 运行时透传、类型断言；未知模型由上游 API 报错（与迁移前
 * 直接把字符串传给 provider SDK 行为一致）。
 */
export function toAdapter(spec: AdapterSpec) {
  switch (spec.kind) {
    case "openai":
      return createOpenaiChatCompletions(
        spec.model as (typeof OPENAI_CHAT_MODELS)[number],
        spec.apiKey,
      );
    case "anthropic":
      return createAnthropicChat(spec.model as (typeof ANTHROPIC_MODELS)[number], spec.apiKey);
    case "gemini":
      return createGeminiChat(spec.model as (typeof GEMINI_MODELS)[number], spec.apiKey);
    case "compat":
      // 默认 chat-completions 端点，与迁移前 createOpenAICompatible 行为一致。
      return openaiCompatibleText(spec.model, { baseURL: spec.baseURL, apiKey: spec.apiKey });
  }
}

/** 解析规格 + 实例化。返回 maxTokensKey 供路由组装 modelOptions。 */
export async function getAdapter(
  provider?: string,
  modelId?: string,
): Promise<{ adapter: ReturnType<typeof toAdapter>; maxTokensKey: string }> {
  const configs = await getAllConfigs();
  const spec = resolveAdapterSpec(provider, modelId, configs);
  logger.debug(`[llm] Loading ${spec.kind} model: ${spec.model}`);
  return { adapter: toAdapter(spec), maxTokensKey: spec.maxTokensKey };
}

/**
 * Check if LLM chat is globally enabled.
 */
export async function isLLMEnabled(): Promise<boolean> {
  const configs = await getAllConfigs();
  return configs.llm_enabled !== "false";
}

/**
 * Return list of configured providers (those with credentials).
 * Ollama 无凭证，以 baseURL 是否配置判定。
 */
export async function getAvailableProviders(): Promise<string[]> {
  const configs = await getAllConfigs();
  const providers: string[] = [];

  if (configs.openai_api_key) providers.push("openai");
  if (configs.anthropic_api_key) providers.push("anthropic");
  if (configs.google_api_key) providers.push("google");
  if (configs.openrouter_api_key) providers.push("openrouter");
  if (configs.deepseek_api_key) providers.push("deepseek");
  if (configs.ollama_base_url) providers.push("ollama");
  if (configs.newapi_base_url && configs.newapi_api_key) providers.push("newapi");

  return providers;
}
