import { consume, revoke } from "@openstarter/billing-web";
import { type AiTask, aiTask, type NewAiTask } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { and, count, desc, eq, isNull, type SQL } from "drizzle-orm";

import { type AITaskInfo, AITaskStatus } from "../media";

const AI_TASK_SCENE = "ai_task";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

export class AITaskNotFoundError extends Error {
  readonly taskId: string;

  constructor(taskId: string) {
    super(`AI task '${taskId}' not found`);
    this.name = "AITaskNotFoundError";
    this.taskId = taskId;
  }
}

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

export interface UpdateTaskParams {
  id: string;
  providerTaskId?: string;
  status: AITaskStatus;
  taskInfo?: AITaskInfo;
  taskResult?: unknown;
}

export interface GetTasksParams {
  mediaType?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  userId: string;
}

export interface GetTasksResult {
  items: AiTask[];
  total: number;
}

export async function findTask(id: string): Promise<AiTask | undefined> {
  const [result] = await db()
    .select()
    .from(aiTask)
    .where(and(eq(aiTask.id, id), isNull(aiTask.deletedAt)))
    .limit(1);
  return result;
}

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

      if (!(result.success && result.consumedCredit)) {
        throw new InsufficientCreditsError();
      }

      await tx.update(aiTask).set({ creditId: result.consumedCredit.id }).where(eq(aiTask.id, id));
    }

    const [created] = await tx.select().from(aiTask).where(eq(aiTask.id, id)).limit(1);
    if (!created) {
      throw new Error("Failed to load AI task after creation");
    }
    return created;
  });
}

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

  if (
    params.status === AITaskStatus.FAILED &&
    existing.status !== AITaskStatus.FAILED &&
    existing.creditId
  ) {
    await revoke({ consumeCreditId: existing.creditId });
  }
}

export async function getTasks(params: GetTasksParams): Promise<GetTasksResult> {
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = [eq(aiTask.userId, params.userId), isNull(aiTask.deletedAt)];
  if (params.mediaType !== undefined) {
    conditions.push(eq(aiTask.mediaType, params.mediaType));
  }
  if (params.status !== undefined) {
    conditions.push(eq(aiTask.status, params.status));
  }
  const where = and(...conditions);

  const [totalRow] = await db().select({ value: count() }).from(aiTask).where(where);

  const items = await db()
    .select()
    .from(aiTask)
    .where(where)
    .orderBy(desc(aiTask.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total: totalRow?.value ?? 0 };
}
