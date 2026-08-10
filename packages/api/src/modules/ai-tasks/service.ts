// packages/api/src/ai-tasks/service —— AI 任务与积分事务联动（AITask_Service，R20）。
//
// 对齐 ShipAny `modules/ai-tasks/service.ts`，落位于 `packages/api/ai-tasks`（design：
// modules/ai-tasks → packages/api/ai-tasks）。复用同包 AI 域（`../ai`）的归一化任务状态词汇，
// 以及积分域（`@openstarter/billing`）的 `consume`/`revoke`，把「任务生命周期」与「按量扣费」
// 在**单事务**内原子联动：
//
//   - createTask（R20.1/R20.2）：单事务内插入 `ai_task`（`pending`）；`costCredits > 0` 时经
//     `consume({ tx })` 扣减——**扣减失败（余额不足）即抛错回滚**：任务不落库、积分不扣（R20.2）；
//     成功则把该次消费流水 id 写入 `ai_task.creditId`（供失败时**精确**撤销）。
//   - updateTask（R20.3/R20.5）：状态置 `failed` 且此前扣过分 → 依 `creditId` 调 `revoke` 精确
//     撤销（R20.3）；置 `success` → 持久化结果并**保留**扣减（R20.5）。撤销仅在「首次」转 failed
//     时触发（`revoke` 本身对已撤销记录幂等，双重保险不重复退款）。
//   - getTasks（R20.4）：按 用户 / 媒体类型 / 状态 组合筛选并分页。
//
// 数据访问统一走 `@openstarter/db`（`db()` 单例 + `@openstarter/db/schema` 表定义），跨方言一致：
// 不依赖 MySQL 缺失的 `.returning()`——自行生成 `id` 并「插入后按 id 回读」返回完整记录；
// 事务由 `db().transaction` 开启，`consume({ tx })` 在同一事务内执行以满足原子性。

import { consume, revoke } from "@openstarter/billing-web";
import { type AiTask, aiTask, type NewAiTask } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { and, count, desc, eq, isNull, type SQL } from "drizzle-orm";

import { type AITaskInfo, AITaskStatus } from "../ai";

// 默认交易场景标签，用于积分流水区分来源（对齐 ShipAny 的 `ai_task`）。
const AI_TASK_SCENE = "ai_task";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

// ─── 可识别错误（Recognizable errors） ───────────────────────────────────────

/**
 * 余额不足错误（R20.2）：`createTask` 在事务内扣减失败时抛出以触发回滚，
 * 使任务不落库、积分不扣。路由层据此转为结构化响应（如 402），不裸抛字符串。
 */
export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

/**
 * 任务不存在错误：`updateTask` 目标任务缺失时抛出，携带任务 id 便于诊断。
 */
export class AITaskNotFoundError extends Error {
  readonly taskId: string;

  constructor(taskId: string) {
    super(`AI task '${taskId}' not found`);
    this.name = "AITaskNotFoundError";
    this.taskId = taskId;
  }
}

// ─── 入参 / 返回类型（Params / Results） ──────────────────────────────────────

/** 创建任务入参。`provider`/`model` 由路由层解析确定；`costCredits` 缺省 0（不扣费）。 */
export interface CreateTaskParams {
  costCredits?: number;
  mediaType: string;
  model: string;
  options?: Record<string, unknown>;
  prompt: string;
  provider: string;
  scene?: string;
  userId: string;
}

/** 更新任务入参。`id` 为 `ai_task` 主键；`providerTaskId` 为供应商侧任务句柄（存入 `taskId` 列）。 */
export interface UpdateTaskParams {
  id: string;
  providerTaskId?: string;
  status: AITaskStatus;
  taskInfo?: AITaskInfo;
  taskResult?: unknown;
}

/** 分页查询入参（R20.4）：省略的筛选条件不参与过滤。 */
export interface GetTasksParams {
  mediaType?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  userId: string;
}

/** 分页查询返回：完整记录与总数（与 `respPage` 结构一致）。 */
export interface GetTasksResult {
  items: AiTask[];
  total: number;
}

// ─── 读取（Read） ─────────────────────────────────────────────────────────────

/** 按 id 读取单条任务（排除已软删记录）；不存在返回 `undefined`。 */
export async function findTask(id: string): Promise<AiTask | undefined> {
  const [result] = await db()
    .select()
    .from(aiTask)
    .where(and(eq(aiTask.id, id), isNull(aiTask.deletedAt)))
    .limit(1);
  return result;
}

// ─── 创建 + 原子扣减（Create，R20.1 / R20.2） ────────────────────────────────

/**
 * 创建 AI 任务并在**同一事务内**按需扣减积分（R20.1）。
 *
 * 流程（单事务，原子）：
 *   1. 插入 `ai_task`（`status='pending'`，`costCredits` 缺省 0）。
 *   2. 若 `costCredits > 0`：经 `consume({ tx })` 在同一事务内扣减——
 *      - 失败（余额不足）→ 抛 {@link InsufficientCreditsError} 触发**整体回滚**：任务不落库、
 *        积分不扣（R20.2）；
 *      - 成功 → 把该次消费流水 id 写入 `ai_task.creditId`（供失败时经 `revoke` **精确**撤销）。
 *   3. 按 id 回读返回完整记录（跨方言一致，不依赖 MySQL 缺失的 `.returning()`）。
 */
export function createTask(params: CreateTaskParams): Promise<AiTask> {
  const id = getUuid();
  const scene = params.scene ?? AI_TASK_SCENE;
  const costCredits = params.costCredits ?? 0;

  const record: NewAiTask = {
    costCredits,
    creditId: null,
    id,
    mediaType: params.mediaType,
    model: params.model,
    options: params.options ? JSON.stringify(params.options) : null,
    prompt: params.prompt,
    provider: params.provider,
    scene,
    status: AITaskStatus.PENDING,
    userId: params.userId,
  };

  return db().transaction(async (tx) => {
    await tx.insert(aiTask).values(record);

    if (costCredits > 0) {
      const result = await consume({
        credits: costCredits,
        description: `AI ${params.mediaType} generation`,
        metadata: JSON.stringify({ taskId: id }),
        scene,
        tx,
        userId: params.userId,
      });

      // 余额不足 → 抛错触发整个事务回滚（任务不落库、积分不扣，R20.2）。
      if (!(result.success && result.consumedCredit)) {
        throw new InsufficientCreditsError();
      }

      // 存入消费流水 id，供任务失败时按此 id 精确撤销（R20.3）。
      await tx
        .update(aiTask)
        .set({ creditId: result.consumedCredit.id })
        .where(eq(aiTask.id, id));
    }

    const [created] = await tx
      .select()
      .from(aiTask)
      .where(eq(aiTask.id, id))
      .limit(1);
    if (!created) {
      throw new Error("Failed to load AI task after creation");
    }
    return created;
  });
}

// ─── 状态更新 + 失败撤销 / 成功保留（Update，R20.3 / R20.5） ──────────────────

/**
 * 更新任务状态与结果，并联动积分撤销 / 保留（R20.3/R20.5）。
 *
 * - 先按 id 定位任务（缺失抛 {@link AITaskNotFoundError}）。
 * - 写入新状态；如提供了供应商任务句柄 / 归一化任务信息 / 原始结果，一并持久化。
 * - `failed` 且**此前扣过分**（`creditId` 存在）且**此前非 failed**（首次转失败）→ 依 `creditId`
 *   调 `revoke` **精确**撤销此前扣减（R20.3）。`revoke` 对已撤销记录幂等，双重保险不重复退款。
 * - `success` → 结果已随本次更新持久化并**保留**扣减（R20.5，无撤销）。
 */
export async function updateTask(params: UpdateTaskParams): Promise<void> {
  const existing = await findTask(params.id);
  if (!existing) {
    throw new AITaskNotFoundError(params.id);
  }

  const patch: Partial<NewAiTask> = { status: params.status };
  if (params.providerTaskId !== undefined) {
    patch.taskId = params.providerTaskId;
  }
  if (params.taskInfo !== undefined) {
    patch.taskInfo = JSON.stringify(params.taskInfo);
  }
  if (params.taskResult !== undefined) {
    patch.taskResult = JSON.stringify(params.taskResult);
  }

  await db().update(aiTask).set(patch).where(eq(aiTask.id, params.id));

  // R20.3：首次转 failed 且此前扣过分 → 依存入的消费流水 id 精确撤销。
  if (
    params.status === AITaskStatus.FAILED &&
    existing.status !== AITaskStatus.FAILED &&
    existing.creditId
  ) {
    await revoke({ consumeCreditId: existing.creditId });
  }
}

// ─── 分页查询：按 用户 / 媒体类型 / 状态 组合筛选（List，R20.4） ────────────────

/**
 * 分页查询用户的 AI 任务（R20.4）：按 `userId` 固定归属，`mediaType`/`status` 可选组合筛选，
 * 按 `createdAt` 倒序返回。默认排除已软删记录。返回条目列表与总数（与 `respPage` 结构一致）。
 */
export async function getTasks(
  params: GetTasksParams
): Promise<GetTasksResult> {
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = [
    eq(aiTask.userId, params.userId),
    isNull(aiTask.deletedAt),
  ];
  if (params.mediaType !== undefined) {
    conditions.push(eq(aiTask.mediaType, params.mediaType));
  }
  if (params.status !== undefined) {
    conditions.push(eq(aiTask.status, params.status));
  }
  const where = and(...conditions);

  const [totalRow] = await db()
    .select({ value: count() })
    .from(aiTask)
    .where(where);

  const items = await db()
    .select()
    .from(aiTask)
    .where(where)
    .orderBy(desc(aiTask.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total: totalRow?.value ?? 0 };
}
