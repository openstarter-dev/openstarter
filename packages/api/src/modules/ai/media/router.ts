// packages/api/src/modules/ai/media —— AI 生成任务路由。
//
// 路由只负责：鉴权/方案门禁、入参校验、把任务编排结果映射为状态码与响应体。
// 供应商解析、定价、建任务（原子扣费）、派发与状态刷新均在 ../tasks/runner。

import { zValidator } from "@hono/zod-validator";
import { respData, respErr, respPage } from "@openstarter/shared";
import { Hono } from "hono";

import { requireAuth } from "../../../middleware/auth";
import { requirePlan } from "../../../middleware/plan-gate";
import { createBody, listQuery } from "../../../schema/ai/media";
import {
  findTask,
  getTasks,
  refreshTask,
  type StartTaskFailure,
  startGenerationTask,
} from "../tasks";

const STATUS_NOT_FOUND = 404;
const STATUS_INSUFFICIENT_CREDITS = 402;
const STATUS_PROVIDER_RUNTIME_ERROR = 502;
const STATUS_PROVIDER_UNAVAILABLE = 503;

/** 编排失败原因 → HTTP 状态。 */
const FAILURE_STATUS = {
  insufficient_credits: STATUS_INSUFFICIENT_CREDITS,
  provider_runtime_error: STATUS_PROVIDER_RUNTIME_ERROR,
  provider_unavailable: STATUS_PROVIDER_UNAVAILABLE,
} as const satisfies Record<StartTaskFailure, number>;

export const aiRouter = new Hono()
  .post(
    "/ai-tasks",
    requireAuth,
    requirePlan("member"),
    zValidator("json", createBody),
    async (c) => {
      const body = c.req.valid("json");
      const outcome = await startGenerationTask({ ...body, userId: c.get("userId") });

      if (!outcome.ok) {
        return c.json(respErr(outcome.message), FAILURE_STATUS[outcome.reason]);
      }
      return c.json(respData(outcome.task));
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

    return c.json(respData(await refreshTask(task)));
  });
