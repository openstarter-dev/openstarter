import { logger } from "@openstarter/shared/logger";
import {
  type AIProviderErrorInfo,
  AIProviderRequestError,
  AIProviderUnavailableError,
  normalizeProviderError,
} from "./errors";
import { getAIManager } from "./manager";
import type { AIGenerateParams, AIMediaType, AIProvider, AITaskResult } from "./types";

export type AIDispatchResult =
  | { success: true; data: AITaskResult }
  | { success: false; error: AIProviderErrorInfo };

async function resolveProvider(name?: string): Promise<AIProvider> {
  const manager = await getAIManager();
  const providerName = name || manager.getDefaultProvider()?.name;
  if (!providerName) {
    throw new AIProviderUnavailableError(name ?? "default");
  }
  const provider = manager.getProvider(providerName);
  if (!provider) {
    throw new AIProviderUnavailableError(providerName);
  }
  return provider;
}

function toDispatchError(
  providerName: string,
  model: string | undefined,
  error: unknown,
): AIDispatchResult {
  logger.error(`[ai] provider '${providerName}' request failed`, error);
  const statusCode = error instanceof AIProviderRequestError ? error.statusCode : undefined;
  return {
    success: false,
    error: normalizeProviderError({
      provider: providerName,
      model,
      error,
      statusCode,
    }),
  };
}

export async function dispatchGenerate(args: {
  provider?: string;
  params: AIGenerateParams;
}): Promise<AIDispatchResult> {
  const provider = await resolveProvider(args.provider);
  try {
    const data = await provider.generate({ params: args.params });
    return { success: true, data };
  } catch (error) {
    return toDispatchError(provider.name, args.params.model, error);
  }
}

export async function dispatchQuery(args: {
  provider?: string;
  taskId: string;
  mediaType?: AIMediaType;
  model?: string;
}): Promise<AIDispatchResult> {
  const provider = await resolveProvider(args.provider);
  if (!provider.query) {
    return toDispatchError(provider.name, args.model, new Error("provider does not support query"));
  }
  try {
    const data = await provider.query({
      taskId: args.taskId,
      mediaType: args.mediaType,
      model: args.model,
    });
    return { success: true, data };
  } catch (error) {
    return toDispatchError(provider.name, args.model, error);
  }
}
