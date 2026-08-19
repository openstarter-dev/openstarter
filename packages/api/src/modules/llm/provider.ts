/**
 * LLM provider resolution — resolves model instances via Vercel AI SDK
 * based on application configuration keys.
 */

import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { getAllConfigs } from "@openstarter/shared/config";
import { logger } from "@openstarter/shared/logger";
import type { LanguageModel } from "ai";

/**
 * Resolve an LLM model instance from config (provider + model name).
 * Throws if the provider is unconfigured or unknown.
 */
export async function getModel(provider?: string, modelId?: string): Promise<LanguageModel> {
  const configs = await getAllConfigs();

  const providerName = provider || configs.llm_provider || "openai";
  const model = modelId || configs.llm_default_model || "gpt-4o-mini";

  switch (providerName) {
    case "openai":
      if (!configs.llm_openai_api_key) {
        throw new Error("OpenAI API key not configured (llm_openai_api_key)");
      }
      logger.debug(`[llm] Loading OpenAI model: ${model}`);
      return openai(model);

    case "anthropic":
      if (!configs.llm_anthropic_api_key) {
        throw new Error("Anthropic API key not configured (llm_anthropic_api_key)");
      }
      logger.debug(`[llm] Loading Anthropic model: ${model}`);
      return anthropic(model);

    case "google":
      if (!configs.llm_google_api_key) {
        throw new Error("Google API key not configured (llm_google_api_key)");
      }
      logger.debug(`[llm] Loading Google model: ${model}`);
      return google(model);

    default:
      throw new Error(`Unknown LLM provider: ${providerName}`);
  }
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
 */
export async function getAvailableProviders(): Promise<string[]> {
  const configs = await getAllConfigs();
  const providers: string[] = [];

  if (configs.llm_openai_api_key) providers.push("openai");
  if (configs.llm_anthropic_api_key) providers.push("anthropic");
  if (configs.llm_google_api_key) providers.push("google");

  return providers;
}
