// packages/api/src/modules/ai/tasks/runner —— 生成任务的运行时编排。
//
// 串起「供应商解析 → 服务端定价 → 建任务（原子扣费）→ 派发 → 结果/状态回写」，
// 供路由层直接消费；路由只保留鉴权、入参校验与状态码映射（不再内联这些步骤）。
//
// 价格口径（Task 7）：目录优先 —— 已定价条目（creditPrice > 0）覆盖 mediaType
// 配置价；目录未命中 / 0 价 / 查询失败一律回退 `ai_credits_cost_<mediaType>`，
// 再回退 `ai_credits_cost`。
//
// 失败语义：配置态不可用（供应商未启用/凭证缺失）与运行态供应商错误分列，
// 由 {@link StartTaskOutcome.reason} 区分，路由据此映射 502/503/402。

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

// ─── 供应商与定价 ──────────────────────────────────────────────────────────────

/** 解析可用的供应商名：显式指定优先，否则默认渠道；不可用返回 null（不抛错）。 */
export async function resolveAvailableProviderName(requested?: string): Promise<string | null> {
  const manager = await getAIManager();
  const name = requested ?? manager.getDefaultProvider()?.name;
  if (!name) {
    return null;
  }
  return manager.getProvider(name) ? name : null;
}

/** 解析本次生成的扣费额度：目录价优先，回退配置价（非法/缺省按 0 处理）。 */
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

// ─── 状态回写 ────────────────────────────────────────────────────────────────

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

/** 派发阶段的失败原因：配置态不可用（503）与运行态供应商错误（502）分列。 */
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

// ─── 对外编排 ────────────────────────────────────────────────────────────────

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

/**
 * 建任务并派发：余额不足 → `insufficient_credits`（任务不落库、积分不扣）；
 * 供应商配置态不可用 → `provider_unavailable`；派发运行态失败 → 任务置失败并
 * 撤销扣费（`provider_runtime_error`）。
 */
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

/**
 * 查询前刷新任务状态：已终态或无供应商任务句柄时原样返回；否则回查供应商并
 * 回写结果。供应商查询失败按「保持原状」处理（不把临时故障写成任务失败）。
 */
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
