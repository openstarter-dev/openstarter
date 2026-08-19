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
} from "./index";
import { createTask, findTask, getTasks, InsufficientCreditsError, updateTask } from "../ai-tasks";
import { requireAuth } from "../../middleware/auth";
import { requirePlan } from "../../middleware/plan-gate";
import { paginationSchema } from "../../schema";

const PROVIDER_UNAVAILABLE_MESSAGE = "AI provider is not enabled or its credentials are missing";

const STATUS_NOT_FOUND = 404;
const STATUS_INSUFFICIENT_CREDITS = 402;
const STATUS_PROVIDER_RUNTIME_ERROR = 502;
const STATUS_PROVIDER_UNAVAILABLE = 503;

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

const listQuery = paginationSchema.extend({
  mediaType: z.enum(MEDIA_TYPE_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
});

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  AITaskStatus.SUCCESS,
  AITaskStatus.FAILED,
  AITaskStatus.CANCELED,
]);

async function resolveProviderName(requested?: string): Promise<string | null> {
  const manager = await getAIManager();
  const name = requested ?? manager.getDefaultProvider()?.name;
  if (!name) {
    return null;
  }
  return manager.getProvider(name) ? name : null;
}

async function resolveCostCredits(mediaType: string): Promise<number> {
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

type GenerationOutcome =
  | { ok: true }
  | {
      ok: false;
      status: typeof STATUS_PROVIDER_RUNTIME_ERROR | typeof STATUS_PROVIDER_UNAVAILABLE;
      message: string;
    };

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

export const aiRouter = new Hono()
  .post(
    "/ai-tasks",
    requireAuth,
    requirePlan("member"),
    zValidator("json", createBody),
    async (c) => {
      const body = c.req.valid("json");
      const userId = c.get("userId");

      const providerName = await resolveProviderName(body.provider);
      if (!providerName) {
        return c.json(respErr(PROVIDER_UNAVAILABLE_MESSAGE), STATUS_PROVIDER_UNAVAILABLE);
      }

      const costCredits = await resolveCostCredits(body.mediaType);

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
    },
  )
  .get(
    "/ai-tasks",
    requireAuth,
    requirePlan("member"),
    zValidator("query", listQuery),
    async (c) => {
      const { page, pageSize, mediaType, status } = c.req.valid("query");
      const { items, total } = await getTasks({
        userId: c.get("userId"),
        mediaType,
        status,
        page,
        pageSize,
      });
      return c.json(respPage(items, total));
    },
  )
  .get("/ai-tasks/:id", requireAuth, requirePlan("member"), async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const task = await findTask(id);
    if (!task || task.userId !== userId) {
      return c.json(respErr("not found"), STATUS_NOT_FOUND);
    }

    const refreshed = await refreshTaskStatus(task);
    return c.json(respData(refreshed));
  });
