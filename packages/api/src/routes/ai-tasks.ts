// packages/api/src/routes/ai-tasks —— AI 任务路由（R20.1/R20.4）。
//
// 三个端点，全部挂 `requireAuth`（会话或有效 API Key，读 `c.var.userId`）：
//   - POST   /api/ai-tasks       创建任务（原子扣分）并经 AI 域 `dispatchGenerate` 发起生成；
//   - GET    /api/ai-tasks/:id   查询单个任务状态/结果（非终态且有供应商句柄时按需刷新）；
//   - GET    /api/ai-tasks       按 媒体类型 / 状态 组合筛选，分页列出**当前用户**的任务。
//
// 扣费金额由 Config 驱动（`ai_credits_cost_<mediaType>` 优先，回退全局 `ai_credits_cost`，
// 缺省 0 = 不扣费）——**不信任客户端传入的费用**，避免越权免费。创建与扣分的原子性、失败撤销、
// 成功保留由 `../ai-tasks` 服务保证；本路由负责「解析可用供应商 → 建任务扣分 → 发起生成 →
// 依结果落状态」的编排，并把两类失败（配置态不可用 / 运行态错误）与余额不足映射为结构化响应。
//
// 供应商语义（对齐 AI 域）：
//   - 配置态不可用（未启用/凭证缺失）：建任务前预检拒绝（不扣费）；生成阶段若抛
//     {@link AIProviderUnavailableError} 则置任务 failed 并撤销后返回 503。
//   - 运行态错误：`dispatchGenerate` 返回 `{ success:false }` → 置任务 failed 并撤销后返回 502。

import { zValidator } from "@hono/zod-validator";
import type { AiTask } from "@openstarter/db/schema";
import { respData, respErr, respPage } from "@openstarter/shared";
import { getAllConfigs } from "@openstarter/shared/config";
import { Hono } from "hono";
import { z } from "zod";

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
} from "../ai";
import {
  createTask,
  findTask,
  getTasks,
  InsufficientCreditsError,
  updateTask,
} from "../ai-tasks";
import { requireAuth } from "../middleware/auth";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const PROVIDER_UNAVAILABLE_MESSAGE =
  "AI provider is not enabled or its credentials are missing";

// HTTP 状态码（避免魔法数字散落）。
const STATUS_NOT_FOUND = 404;
const STATUS_INSUFFICIENT_CREDITS = 402;
const STATUS_PROVIDER_RUNTIME_ERROR = 502;
const STATUS_PROVIDER_UNAVAILABLE = 503;

// 受支持的媒体类型 / 任务状态取值元组，供 `z.enum` 校验复用。
const MEDIA_TYPE_VALUES = [
  AIMediaType.MUSIC,
  AIMediaType.IMAGE,
  AIMediaType.VIDEO,
  AIMediaType.TEXT,
  AIMediaType.SPEECH,
] as const;

const STATUS_VALUES = [
  AITaskStatus.PENDING,
  AITaskStatus.PROCESSING,
  AITaskStatus.SUCCESS,
  AITaskStatus.FAILED,
  AITaskStatus.CANCELED,
] as const;

const createBody = z.object({
  mediaType: z.enum(MEDIA_TYPE_VALUES),
  provider: z.string().min(1).optional(),
  model: z.string().min(1),
  prompt: z.string().min(1),
  options: z.record(z.string(), z.unknown()).optional(),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  mediaType: z.enum(MEDIA_TYPE_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
});

// 终态集合：这些状态无需再向供应商刷新（查询时直接返回存量）。
const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  AITaskStatus.SUCCESS,
  AITaskStatus.FAILED,
  AITaskStatus.CANCELED,
]);

/**
 * 解析可用供应商名：显式指定优先，否则取默认渠道；未装配（未启用/凭证缺失）返回 `null`。
 * 在建任务/扣费**之前**预检，避免对不可用渠道先扣费再撤销的churn。
 */
async function resolveProviderName(requested?: string): Promise<string | null> {
  const manager = await getAIManager();
  const name = requested ?? manager.getDefaultProvider()?.name;
  if (!name) {
    return null;
  }
  return manager.getProvider(name) ? name : null;
}

/**
 * 依 Config 解析某媒体类型的扣费积分：`ai_credits_cost_<mediaType>` 优先，回退全局
 * `ai_credits_cost`；非法/缺省/非正数一律回退 0（不扣费）。**不读取客户端入参**。
 */
async function resolveCostCredits(mediaType: string): Promise<number> {
  const configs = await getAllConfigs();
  const raw = configs[`ai_credits_cost_${mediaType}`] ?? configs.ai_credits_cost;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** 置任务失败并持久化可读错误信息（updateTask 内部据此撤销此前扣减，R20.3）。 */
function markTaskFailed(id: string, errorMessage: string): Promise<void> {
  return updateTask({
    id,
    status: AITaskStatus.FAILED,
    taskInfo: { errorMessage },
  });
}

/** 把生成结果落到任务（状态 / 供应商句柄 / 归一化信息 / 原始结果）。成功保留扣减（R20.5）。 */
function persistDispatchData(id: string, data: AITaskResult): Promise<void> {
  return updateTask({
    id,
    status: data.taskStatus,
    providerTaskId: data.taskId,
    taskInfo: data.taskInfo,
    taskResult: data.taskResult,
  });
}

/** 生成编排结果：成功或（携带状态码与消息的）失败。 */
type GenerationOutcome =
  | { ok: true }
  | {
      ok: false;
      status:
        | typeof STATUS_PROVIDER_RUNTIME_ERROR
        | typeof STATUS_PROVIDER_UNAVAILABLE;
      message: string;
    };

/**
 * 发起生成并按结果落任务状态：
 * - 抛 {@link AIProviderUnavailableError}（配置态不可用）→ 置 failed 撤销，返回 503；
 * - `{ success:false }`（运行态错误）→ 置 failed 撤销，返回 502；
 * - 成功 → 持久化结果并保留扣减，返回 `{ ok:true }`。
 */
async function runGeneration(
  taskId: string,
  providerName: string,
  params: AIGenerateParams
): Promise<GenerationOutcome> {
  let dispatch: AIDispatchResult;
  try {
    dispatch = await dispatchGenerate({ provider: providerName, params });
  } catch (error) {
    if (error instanceof AIProviderUnavailableError) {
      await markTaskFailed(taskId, error.message);
      return {
        ok: false,
        status: STATUS_PROVIDER_UNAVAILABLE,
        message: error.message,
      };
    }
    throw error;
  }

  if (!dispatch.success) {
    await markTaskFailed(taskId, dispatch.error.message);
    return {
      ok: false,
      status: STATUS_PROVIDER_RUNTIME_ERROR,
      message: dispatch.error.message,
    };
  }

  await persistDispatchData(taskId, dispatch.data);
  return { ok: true };
}

/**
 * 非终态且持有供应商句柄的任务：向供应商刷新一次状态/结果并持久化后返回最新记录。
 * 供应商查询失败（不可用或运行态错误）不改动任务（避免瞬时错误误置失败/误撤销），返回存量。
 */
async function refreshTaskStatus(task: AiTask): Promise<AiTask> {
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

export const aiTasksRoute = new Hono()
  .post("/api/ai-tasks", requireAuth, zValidator("json", createBody), async (c) => {
    const body = c.req.valid("json");
    const userId = c.get("userId");

    // 预检：无可用供应商则直接拒绝，不建任务、不扣费。
    const providerName = await resolveProviderName(body.provider);
    if (!providerName) {
      return c.json(
        respErr(PROVIDER_UNAVAILABLE_MESSAGE),
        STATUS_PROVIDER_UNAVAILABLE
      );
    }

    const costCredits = await resolveCostCredits(body.mediaType);

    // 建任务 + 原子扣分（余额不足 → 整体回滚，任务不落库、积分不扣，R20.2）。
    let task: AiTask;
    try {
      task = await createTask({
        userId,
        mediaType: body.mediaType,
        provider: providerName,
        model: body.model,
        prompt: body.prompt,
        options: body.options,
        costCredits,
      });
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return c.json(respErr("insufficient credits"), STATUS_INSUFFICIENT_CREDITS);
      }
      throw error;
    }

    // 发起生成并按结果落状态（失败则撤销已扣积分，R20.3）。
    const params: AIGenerateParams = {
      mediaType: body.mediaType,
      prompt: body.prompt,
      model: body.model,
      options: body.options,
    };
    const outcome = await runGeneration(task.id, providerName, params);
    if (!outcome.ok) {
      return c.json(respErr(outcome.message), outcome.status);
    }

    const updated = await findTask(task.id);
    return c.json(respData(updated ?? task));
  })
  .get("/api/ai-tasks", requireAuth, zValidator("query", listQuery), async (c) => {
    const { page, pageSize, mediaType, status } = c.req.valid("query");
    const { items, total } = await getTasks({
      userId: c.get("userId"),
      mediaType,
      status,
      page,
      pageSize,
    });
    return c.json(respPage(items, total));
  })
  .get("/api/ai-tasks/:id", requireAuth, async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const task = await findTask(id);
    // 访问隔离：仅本人任务可见；不存在或非本人 → 404。
    if (!task || task.userId !== userId) {
      return c.json(respErr("not found"), STATUS_NOT_FOUND);
    }

    const refreshed = await refreshTaskStatus(task);
    return c.json(respData(refreshed));
  });
