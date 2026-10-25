/**
 * AI model catalog routes — 前台门面 + admin CRUD（Task 4）。
 *
 * - `aiModelsRouter`：`GET /ai/models` 门面端点，挂载于组合根 "/" 下，经 basePath
 *   暴露为 `GET /api/ai/models`（`client.api.ai.models.$get()`）。requireAuth +
 *   requirePlan("member")，返回 Task 3 {@link listAvailableModelsByMediaType} 的
 *   五键分组（仅 enabled 且 provider 可用的模型）。
 * - `adminAiModelsRouter`：admin 侧目录 CRUD，经 admin/router.ts 挂载为
 *   `/api/admin/ai-models*`。`.use(requireAuth).use(requirePermission("admin.*"))`
 *   与 rbac/overview 等子路由一致，自包含、可独立测试。
 *
 * 错误语义沿用仓库约定：重复 (provider, modelId) 转 409 信封、目标缺失 404、
 * zValidator 校验失败 400，其余错误上抛交由 app.onError 统一处理。
 */

import { zValidator } from "@hono/zod-validator";
import { respData, respErr, respOk, respPage } from "@openstarter/shared";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../../../middleware/auth";
import { requirePlan } from "../../../middleware/plan-gate";
import { requirePermission } from "../../../middleware/rbac";
import { idParam, paginationSchema } from "../../../schema";
import {
  AI_MEDIA_TYPES,
  createModel,
  deleteModel,
  DuplicateModelError,
  listAvailableModelsByMediaType,
  listModels,
  updateModel,
} from "./service";

const DUPLICATE_STATUS = 409;
const NOT_FOUND_STATUS = 404;

const PERMISSION_ADMIN = "admin.*";

const createBody = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  mediaType: z.enum(AI_MEDIA_TYPES),
  creditPrice: z.number().int().min(0).default(0),
  maxOutputTokens: z.number().int().min(1).nullable().optional(),
  optionsSchema: z.string().nullable().optional(),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  metadata: z.string().nullable().optional(),
});

// update schema 不能复用 createBody.partial()：partial 会保留字段的 .default()，
// 解析时把未提交的字段重置为默认值。这里逐字段 optional（无 default），未提交的
// 键不会出现在解析结果中，updateModel 只更新实际提交的字段。
const updateBody = createBody.extend({
  provider: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  mediaType: z.enum(AI_MEDIA_TYPES).optional(),
  creditPrice: z.number().int().min(0).optional(),
  maxOutputTokens: z.number().int().min(1).nullable().optional(),
  optionsSchema: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metadata: z.string().nullable().optional(),
});

const listQuery = paginationSchema.extend({
  mediaType: z.enum(AI_MEDIA_TYPES).optional(),
});

/** 前台门面：按媒体类型分组的可用模型目录。 */
export const aiModelsRouter = new Hono().get(
  "/ai/models",
  requireAuth,
  requirePlan("member"),
  async (c) => {
    const grouped = await listAvailableModelsByMediaType();
    return c.json(respData(grouped));
  },
);

/** admin 目录 CRUD：GET/POST /ai-models + PATCH/DELETE /ai-models/:id。 */
export const adminAiModelsRouter = new Hono()
  .use(requireAuth)
  .use(requirePermission(PERMISSION_ADMIN))
  .get("/", zValidator("query", listQuery), async (c) => {
    const { page, pageSize, mediaType } = c.req.valid("query");
    const models = await listModels({});
    const filtered = mediaType ? models.filter((model) => model.mediaType === mediaType) : models;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    return c.json(respPage(items, filtered.length));
  })
  .post("/", zValidator("json", createBody), async (c) => {
    const body = c.req.valid("json");
    try {
      const created = await createModel(body);
      return c.json(respData(created));
    } catch (error) {
      if (error instanceof DuplicateModelError) {
        return c.json(respErr(error.message), DUPLICATE_STATUS);
      }
      throw error;
    }
  })
  .patch("/:id", zValidator("param", idParam), zValidator("json", updateBody), async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await updateModel({ id, ...body });
    if (!updated) {
      return c.json(respErr("ai model not found"), NOT_FOUND_STATUS);
    }
    return c.json(respData(updated));
  })
  .delete("/:id", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await deleteModel(id);
    if (!deleted) {
      return c.json(respErr("ai model not found"), NOT_FOUND_STATUS);
    }
    return c.json(respOk());
  });
