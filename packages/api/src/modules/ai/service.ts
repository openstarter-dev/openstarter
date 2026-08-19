// packages/api/src/ai/service —— 供应商路由分派与错误处理（R19.2/R19.3/R19.4）。
//
// 依指定供应商/模型转发生成/查询请求并返回结果或任务句柄（R19.2）。两类错误严格区分：
//
//   - 配置态不可用（R19.3）：所选供应商未启用或凭证缺失（管理器未装配该 provider）→ 明确「拒绝」，
//     抛出可识别的 {@link AIProviderUnavailableError}（与支付渠道不可用同构，由路由层/app.onError
//     统一转为结构化响应）。
//
//   - 运行态供应商错误（R19.4）：provider 调用过程抛错（网络失败、非 2xx、解析错误等）→ 捕获并
//     归一化为 {@link AIProviderErrorInfo}，随判别联合 `{ success:false, error }` 结构化回传，
//     不抛未捕获异常、不使进程崩溃。
//
// 判别联合返回便于任务与积分联动（任务 27）消费：`success:false` 时把任务置失败并撤销已扣积分，
// `success:true` 时持久化 `data`（含供应商任务句柄 taskId）。

import { logger } from "@openstarter/shared/logger";
import {
  type AIProviderErrorInfo,
  AIProviderRequestError,
  AIProviderUnavailableError,
  normalizeProviderError,
} from "./errors";
import { getAIManager } from "./manager";
import type { AIGenerateParams, AIMediaType, AIProvider, AITaskResult } from "./types";

/**
 * 路由分派结果（判别联合）：
 * - 成功 → `{ success: true, data }`（`data` 为归一化任务结果/句柄）。
 * - 供应商运行态失败 → `{ success: false, error }`（结构化错误信息，R19.4）。
 * 配置态不可用不走此返回，而是抛出 {@link AIProviderUnavailableError}（R19.3）。
 */
export type AIDispatchResult =
  | { success: true; data: AITaskResult }
  | { success: false; error: AIProviderErrorInfo };

/**
 * 解析目标供应商：显式指定优先，否则回退默认渠道。二者都取不到（未装配 = 未启用/凭证缺失）
 * 即视为不可用，抛出 {@link AIProviderUnavailableError}（R19.3，与支付渠道不可用同构）。
 */
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

/** 把供应商运行态抛错归一化为结构化失败结果（R19.4）：记日志、提取状态码、不外泄堆栈。 */
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

/**
 * 依指定供应商/模型转发生成请求并返回结果或任务句柄（R19.2）。
 * @throws {AIProviderUnavailableError} 目标供应商未启用或凭证缺失时（R19.3）。
 */
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

/**
 * 依指定供应商/模型查询任务状态与结果（R19.2）。
 * @throws {AIProviderUnavailableError} 目标供应商未启用或凭证缺失时（R19.3）。
 */
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
