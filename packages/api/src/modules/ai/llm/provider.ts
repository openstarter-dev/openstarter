import { getAllConfigs } from "@openstarter/shared/config";
import { logger } from "@openstarter/shared/logger";
import { ANTHROPIC_MODELS, createAnthropicChat } from "@tanstack/ai-anthropic";
import { GEMINI_MODELS, createGeminiChat } from "@tanstack/ai-gemini";
import { OPENAI_CHAT_MODELS, createOpenaiChatCompletions } from "@tanstack/ai-openai";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";

const OLLAMA_PLACEHOLDER_KEY = "ollama";

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
  ollama: {
    baseURLKey: "ollama_base_url",
    defaultBaseURL: "",
    maxTokensKey: "max_tokens",
  },
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
  const configs = await getAllConfigs();
  const spec = resolveAdapterSpec(provider, modelId, configs);
  logger.debug(`[llm] Loading ${spec.kind} model: ${spec.model}`);
  return { adapter: toAdapter(spec), maxTokensKey: spec.maxTokensKey };
}

export async function isLLMEnabled(): Promise<boolean> {
  const configs = await getAllConfigs();
  return configs.llm_enabled !== "false";
}

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
