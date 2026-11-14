import { logger } from "@openstarter/shared/logger";
import { ANTHROPIC_MODELS, createAnthropicChat } from "@tanstack/ai-anthropic";
import { GEMINI_MODELS, createGeminiChat } from "@tanstack/ai-gemini";
import { OPENAI_CHAT_MODELS, createOpenaiChatCompletions } from "@tanstack/ai-openai";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";

import { readBooleanEnv, readEnv } from "../../../lib/env";

const OLLAMA_PLACEHOLDER_KEY = "ollama";

const OPENAI_COMPATIBLE_PROVIDERS = {
  openrouter: {
    apiKeyEnv: "OPENROUTER_API_KEY",
    baseURLEnv: "OPENROUTER_BASE_URL",
    defaultBaseURL: "https://openrouter.ai/api/v1",
    maxTokensKey: "max_tokens",
  },
  deepseek: {
    apiKeyEnv: "DEEPSEEK_API_KEY",
    baseURLEnv: "DEEPSEEK_BASE_URL",
    defaultBaseURL: "https://api.deepseek.com/v1",
    maxTokensKey: "max_tokens",
  },
  ollama: {
    apiKeyEnv: "",
    baseURLEnv: "OLLAMA_BASE_URL",
    defaultBaseURL: "",
    maxTokensKey: "max_tokens",
  },
  newapi: {
    apiKeyEnv: "NEWAPI_API_KEY",
    baseURLEnv: "NEWAPI_BASE_URL",
    defaultBaseURL: "",
    maxTokensKey: "max_tokens",
  },
} as const;

export type OpenAICompatibleProviderName = keyof typeof OPENAI_COMPATIBLE_PROVIDERS;

function isOpenAICompatibleProvider(name: string): name is OpenAICompatibleProviderName {
  return name in OPENAI_COMPATIBLE_PROVIDERS;
}

export interface LlmEnvConfig {
  DEFAULT_LLM_PROVIDER?: string;
  LLM_ENABLED?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  OPENROUTER_BASE_URL?: string;
  OPENROUTER_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  NEWAPI_BASE_URL?: string;
  NEWAPI_API_KEY?: string;
}

/**
 * Snapshot all LLM provider environment variables on demand.
 * 按需采集 LLM 相关环境变量快照，便于在适配器解析阶段保持纯函数特性。
 */
export function readLlmEnvConfig(): LlmEnvConfig {
  return {
    DEFAULT_LLM_PROVIDER: readEnv("DEFAULT_LLM_PROVIDER"),
    LLM_ENABLED: readEnv("LLM_ENABLED"),
    OPENAI_API_KEY: readEnv("OPENAI_API_KEY"),
    ANTHROPIC_API_KEY: readEnv("ANTHROPIC_API_KEY"),
    GOOGLE_API_KEY: readEnv("GOOGLE_API_KEY"),
    OPENROUTER_BASE_URL: readEnv("OPENROUTER_BASE_URL"),
    OPENROUTER_API_KEY: readEnv("OPENROUTER_API_KEY"),
    DEEPSEEK_BASE_URL: readEnv("DEEPSEEK_BASE_URL"),
    DEEPSEEK_API_KEY: readEnv("DEEPSEEK_API_KEY"),
    OLLAMA_BASE_URL: readEnv("OLLAMA_BASE_URL"),
    NEWAPI_BASE_URL: readEnv("NEWAPI_BASE_URL"),
    NEWAPI_API_KEY: readEnv("NEWAPI_API_KEY"),
  };
}

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

/**
 * Resolve concrete LLM adapter parameters from explicit selection + env config snapshot.
 * 根据目标供应商/模型与环境变量快照解析具体适配器配置，缺失凭证时明确抛错。
 */
export function resolveAdapterSpec(
  provider: string | undefined,
  modelId: string | undefined,
  configs: LlmEnvConfig,
): AdapterSpec {
  const providerName = provider || configs.DEFAULT_LLM_PROVIDER || "openai";
  const model = modelId || "gpt-4o-mini";

  if (providerName === "openai") {
    if (!configs.OPENAI_API_KEY) throw new Error("OpenAI API key not configured (OPENAI_API_KEY)");
    return { kind: "openai", model, apiKey: configs.OPENAI_API_KEY, maxTokensKey: "max_tokens" };
  }
  if (providerName === "anthropic") {
    if (!configs.ANTHROPIC_API_KEY)
      throw new Error("Anthropic API key not configured (ANTHROPIC_API_KEY)");
    return {
      kind: "anthropic",
      model,
      apiKey: configs.ANTHROPIC_API_KEY,
      maxTokensKey: "max_tokens",
    };
  }
  if (providerName === "google") {
    if (!configs.GOOGLE_API_KEY) throw new Error("Google API key not configured (GOOGLE_API_KEY)");
    return {
      kind: "gemini",
      model,
      apiKey: configs.GOOGLE_API_KEY,
      maxTokensKey: "maxOutputTokens",
    };
  }
  if (!isOpenAICompatibleProvider(providerName)) {
    throw new Error(`Unknown LLM provider: ${providerName}`);
  }
  const { baseURLEnv, defaultBaseURL, maxTokensKey } = OPENAI_COMPATIBLE_PROVIDERS[providerName];
  const baseURL = configs[baseURLEnv] || defaultBaseURL;
  if (!baseURL) {
    throw new Error(`${providerName} base URL not configured (${baseURLEnv})`);
  }
  if (providerName === "ollama") {
    return {
      kind: "compat",
      name: providerName,
      model,
      baseURL,
      apiKey: OLLAMA_PLACEHOLDER_KEY,
      maxTokensKey,
    };
  }
  const { apiKeyEnv } = OPENAI_COMPATIBLE_PROVIDERS[providerName];
  const apiKey = configs[apiKeyEnv] || "";
  if (!apiKey) {
    throw new Error(`${providerName} API key not configured (${apiKeyEnv})`);
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
      return openaiCompatibleText(spec.model, { baseURL: spec.baseURL, apiKey: spec.apiKey });
  }
}

export async function getAdapter(
  provider?: string,
  modelId?: string,
): Promise<{ adapter: ReturnType<typeof toAdapter>; maxTokensKey: string }> {
  const configs = readLlmEnvConfig();
  const spec = resolveAdapterSpec(provider, modelId, configs);
  logger.debug(`[llm] Loading ${spec.kind} model: ${spec.model}`);
  return { adapter: toAdapter(spec), maxTokensKey: spec.maxTokensKey };
}

export async function isLLMEnabled(): Promise<boolean> {
  return readBooleanEnv("LLM_ENABLED", true);
}

export async function getAvailableProviders(): Promise<string[]> {
  const configs = readLlmEnvConfig();
  const providers: string[] = [];

  if (configs.OPENAI_API_KEY) providers.push("openai");
  if (configs.ANTHROPIC_API_KEY) providers.push("anthropic");
  if (configs.GOOGLE_API_KEY) providers.push("google");
  if (configs.OPENROUTER_API_KEY) providers.push("openrouter");
  if (configs.DEEPSEEK_API_KEY) providers.push("deepseek");
  if (configs.OLLAMA_BASE_URL) providers.push("ollama");
  if (configs.NEWAPI_BASE_URL && configs.NEWAPI_API_KEY) providers.push("newapi");

  return providers;
}
