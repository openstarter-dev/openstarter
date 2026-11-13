import type { AiTask } from "@openstarter/db/schema";
import { getAllConfigs } from "@openstarter/shared/config";

import { findModelByProviderAndId } from "../catalog/service";
import {
  type AIDispatchResult,
  type AIGenerateParams,
  AIMediaType,
  AIProviderUnavailableError,
  type AITaskResult,
  AITaskStatus,
  dispatchGenerate,
  dispatchQuery,
  getAIManager,
} from "../media";
import { createTask, findTask, InsufficientCreditsError, updateTask } from "./service";

const PROVIDER_UNAVAILABLE_MESSAGE = "AI provider is not enabled or its credentials are missing";

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  AITaskStatus.SUCCESS,
  AITaskStatus.FAILED,
  AITaskStatus.CANCELED,
]);

export async function resolveAvailableProviderName(requested?: string): Promise<string | null> {
  const manager = await getAIManager();
  const name = requested ?? manager.getDefaultProvider()?.name;
  if (!name) {
    return null;
  }
  return manager.getProvider(name) ? name : null;
}

export async function resolveTaskCostCredits(
  mediaType: string,
  provider?: string,
  model?: string,
): Promise<number> {
  if (provider && model) {
    try {
      const catalogModel = await findModelByProviderAndId(provider, model);
      if (catalogModel && catalogModel.creditPrice > 0) {
        return catalogModel.creditPrice;
      }
    } catch {
      // 目录不可用时按未定价处理，走配置回退。
    }
  }

  const configs = await getAllConfigs();
  const raw = configs[`ai_credits_cost_${mediaType}`] ?? configs.ai_credits_cost;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}


function markTaskFailed(id: string, errorMessage: string): Promise<void> {
  return updateTask({
    id,
    status: AITaskStatus.FAILED,
    taskInfo: { errorMessage },
  });
}

function persistDispatchData(id: string, data: AITaskResult): Promise<void> {
  return updateTask({
    id,
    status: data.taskStatus,
    providerTaskId: data.taskId,
    taskInfo: data.taskInfo,
    taskResult: data.taskResult,
  });
}

type DispatchFailure = "provider_runtime_error" | "provider_unavailable";

type GenerationOutcome = { ok: true } | { message: string; ok: false; reason: DispatchFailure };

async function runGeneration(
  taskId: string,
  providerName: string,
  params: AIGenerateParams,
): Promise<GenerationOutcome> {
  let dispatch: AIDispatchResult;
  try {
    dispatch = await dispatchGenerate({ provider: providerName, params });
  } catch (error) {
    if (error instanceof AIProviderUnavailableError) {
      await markTaskFailed(taskId, error.message);
      return { message: error.message, ok: false, reason: "provider_unavailable" };
    }
    throw error;
  }

  if (!dispatch.success) {
    await markTaskFailed(taskId, dispatch.error.message);
    return { message: dispatch.error.message, ok: false, reason: "provider_runtime_error" };
  }

  await persistDispatchData(taskId, dispatch.data);
  return { ok: true };
}


export type StartTaskFailure = DispatchFailure | "insufficient_credits";

export type StartTaskOutcome =
  | { ok: true; task: AiTask }
  | { message: string; ok: false; reason: StartTaskFailure };

export interface StartGenerationTaskParams {
  mediaType: AIMediaType;
  model: string;
  options?: Record<string, unknown>;
  prompt: string;
  provider?: string;
  userId: string;
}

export async function startGenerationTask(
  params: StartGenerationTaskParams,
): Promise<StartTaskOutcome> {
  const { mediaType, model, options, prompt, provider, userId } = params;

  const providerName = await resolveAvailableProviderName(provider);
  if (!providerName) {
    return { message: PROVIDER_UNAVAILABLE_MESSAGE, ok: false, reason: "provider_unavailable" };
  }

  const costCredits = await resolveTaskCostCredits(mediaType, providerName, model);

  let task: AiTask;
  try {
    task = await createTask({
      userId,
      mediaType,
      provider: providerName,
      model,
      prompt,
      options,
      costCredits,
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return { message: "insufficient credits", ok: false, reason: "insufficient_credits" };
    }
    throw error;
  }

  const outcome = await runGeneration(task.id, providerName, {
    mediaType,
    prompt,
    model,
    options,
  });
  if (!outcome.ok) {
    return { message: outcome.message, ok: false, reason: outcome.reason };
  }

  const updated = await findTask(task.id);
  return { ok: true, task: updated ?? task };
}

export async function refreshTask(task: AiTask): Promise<AiTask> {
  if (!task.taskId || TERMINAL_STATUSES.has(task.status)) {
    return task;
  }

  let dispatch: AIDispatchResult;
  try {
    dispatch = await dispatchQuery({
      provider: task.provider,
      taskId: task.taskId,
      mediaType: task.mediaType as AIMediaType,
      model: task.model,
    });
  } catch {
    return task;
  }

  if (!dispatch.success) {
    return task;
  }

  await persistDispatchData(task.id, dispatch.data);
  return (await findTask(task.id)) ?? task;
}
