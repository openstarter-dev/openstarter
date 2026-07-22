// packages/api/src/routes/taxonomy —— 分类管理路由（R15.1）。
//
// 分类的列表 / 读取 / 创建 / 更新 / 软删除，均属平台级**管理操作**：先经 `requireAuth`
// （会话或有效 API Key）解析主体，再由 `requirePermission(taxonomy.<action>)` 依**通配符 RBAC**
// 判定权限（授予 `taxonomy.*` 或 `*` 即通行，缺失返回 403），与 better-auth `organization` 解耦。
// 入参经 `zValidator` 校验。
//
// slug 唯一冲突：Taxonomy_Service 抛可识别的 {@link SlugConflictError}，此处转 409 HTTPException，
// 交由 `app.onError` 统一返回结构化 `respErr`（对齐 checkout 对 PaymentProviderUnavailableError
// 的处理约定，避免裸抛字符串）。资源不存在返回结构化 404。

import { zValidator } from "@hono/zod-validator";
import { respData, respErr, respOk, respPage } from "@openstarter/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { SlugConflictError } from "../content/errors";
import {
  createTaxonomy,
  deleteTaxonomy,
  getTaxonomyById,
  listTaxonomy,
  TAXONOMY_STATUS_VALUES,
  updateTaxonomy,
} from "../content/taxonomy";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const SLUG_CONFLICT_STATUS = 409;
const NOT_FOUND_STATUS = 404;

// 权限码（`resource.action`）。与通配符 RBAC 约定一致：授予 `taxonomy.*` 或 `*` 即可通行。
const PERMISSION_READ = "taxonomy.read";
const PERMISSION_CREATE = "taxonomy.create";
const PERMISSION_UPDATE = "taxonomy.update";
const PERMISSION_DELETE = "taxonomy.delete";

const listQuery = z.object({
  type: z.string().min(1).optional(),
  status: z.enum(TAXONOMY_STATUS_VALUES).optional(),
  parentId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

const idParam = z.object({ id: z.string().min(1) });

const createBody = z.object({
  slug: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().min(1).optional(),
  sort: z.number().int().optional(),
  status: z.enum(TAXONOMY_STATUS_VALUES).optional(),
});

const updateBody = z.object({
  slug: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  sort: z.number().int().optional(),
  status: z.enum(TAXONOMY_STATUS_VALUES).optional(),
});

/** slug 唯一冲突转 409（交由 app.onError 统一返回结构化 respErr）；其余错误原样上抛。 */
function rethrowAsHttp(err: unknown): never {
  if (err instanceof SlugConflictError) {
    throw new HTTPException(SLUG_CONFLICT_STATUS, { message: err.message });
  }
  throw err;
}

export const taxonomyRoute = new Hono()
  .get(
    "/api/taxonomy",
    requireAuth,
    requirePermission(PERMISSION_READ),
    zValidator("query", listQuery),
    async (c) => {
      const { type, status, parentId, page, pageSize } = c.req.valid("query");
      const { items, total } = await listTaxonomy({
        type,
        status,
        parentId,
        page,
        pageSize,
      });
      return c.json(respPage(items, total));
    }
  )
  .get(
    "/api/taxonomy/:id",
    requireAuth,
    requirePermission(PERMISSION_READ),
    zValidator("param", idParam),
    async (c) => {
      const { id } = c.req.valid("param");
      const item = await getTaxonomyById(id);
      if (!item) {
        return c.json(respErr("taxonomy not found"), NOT_FOUND_STATUS);
      }
      return c.json(respData(item));
    }
  )
  .post(
    "/api/taxonomy",
    requireAuth,
    requirePermission(PERMISSION_CREATE),
    zValidator("json", createBody),
    async (c) => {
      const body = c.req.valid("json");
      try {
        const created = await createTaxonomy({
          userId: c.get("userId"),
          ...body,
        });
        return c.json(respData(created));
      } catch (err) {
        return rethrowAsHttp(err);
      }
    }
  )
  .put(
    "/api/taxonomy/:id",
    requireAuth,
    requirePermission(PERMISSION_UPDATE),
    zValidator("param", idParam),
    zValidator("json", updateBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      try {
        const updated = await updateTaxonomy(id, body);
        if (!updated) {
          return c.json(respErr("taxonomy not found"), NOT_FOUND_STATUS);
        }
        return c.json(respData(updated));
      } catch (err) {
        return rethrowAsHttp(err);
      }
    }
  )
  .delete(
    "/api/taxonomy/:id",
    requireAuth,
    requirePermission(PERMISSION_DELETE),
    zValidator("param", idParam),
    async (c) => {
      const { id } = c.req.valid("param");
      await deleteTaxonomy(id);
      return c.json(respOk());
    }
  );
