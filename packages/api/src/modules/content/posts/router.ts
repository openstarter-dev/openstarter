import { zValidator } from "@hono/zod-validator";
import { respData, respErr, respOk, respPage } from "@openstarter/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { SlugConflictError } from "../errors";
import {
  createPost,
  deletePost,
  getPostById,
  listPosts,
  POST_STATUS_VALUES,
  POST_TYPE_VALUES,
  updatePost,
} from "../posts";
import { requireAuth } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/rbac";
import { idParam, createPaginationSchema } from "../../../schema";

const SLUG_CONFLICT_STATUS = 409;
const NOT_FOUND_STATUS = 404;

// 权限码（`resource.action`）。与通配符 RBAC 约定一致：授予 `post.*` 或 `*` 即可通行。
const PERMISSION_READ = "post.read";
const PERMISSION_CREATE = "post.create";
const PERMISSION_UPDATE = "post.update";
const PERMISSION_DELETE = "post.delete";

const listQuery = createPaginationSchema(100, 10).extend({
  type: z.enum(POST_TYPE_VALUES).optional(),
  status: z.enum(POST_STATUS_VALUES).optional(),
  search: z.string().min(1).optional(),
});

const createBody = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(POST_TYPE_VALUES).optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  image: z.string().optional(),
  categories: z.string().optional(),
  tags: z.string().optional(),
  authorName: z.string().optional(),
  authorImage: z.string().optional(),
  parentId: z.string().min(1).optional(),
  status: z.enum(POST_STATUS_VALUES).optional(),
  sort: z.number().int().optional(),
});

const updateBody = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  type: z.enum(POST_TYPE_VALUES).optional(),
  description: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  categories: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
  authorName: z.string().nullable().optional(),
  authorImage: z.string().nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  status: z.enum(POST_STATUS_VALUES).optional(),
  sort: z.number().int().optional(),
});

/** slug 唯一冲突转 409（交由 app.onError 统一返回结构化 respErr）；其余错误原样上抛。 */
function rethrowAsHttp(err: unknown): never {
  if (err instanceof SlugConflictError) {
    throw new HTTPException(SLUG_CONFLICT_STATUS, { message: err.message });
  }
  throw err;
}

export const postsRouter = new Hono()
  .get(
    "/",
    requireAuth,
    requirePermission(PERMISSION_READ),
    zValidator("query", listQuery),
    async (c) => {
      const { type, status, search, page, pageSize } = c.req.valid("query");
      const { items, total } = await listPosts({
        type,
        status,
        search,
        page,
        pageSize,
      });
      return c.json(respPage(items, total));
    },
  )
  .get(
    "/:id",
    requireAuth,
    requirePermission(PERMISSION_READ),
    zValidator("param", idParam),
    async (c) => {
      const { id } = c.req.valid("param");
      const item = await getPostById(id);
      if (!item) {
        return c.json(respErr("post not found"), NOT_FOUND_STATUS);
      }
      return c.json(respData(item));
    },
  )
  .post(
    "/",
    requireAuth,
    requirePermission(PERMISSION_CREATE),
    zValidator("json", createBody),
    async (c) => {
      const body = c.req.valid("json");
      try {
        const created = await createPost({
          userId: c.get("userId"),
          ...body,
        });
        return c.json(respData(created));
      } catch (err) {
        return rethrowAsHttp(err);
      }
    },
  )
  .put(
    "/:id",
    requireAuth,
    requirePermission(PERMISSION_UPDATE),
    zValidator("param", idParam),
    zValidator("json", updateBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      try {
        const updated = await updatePost(id, body);
        if (!updated) {
          return c.json(respErr("post not found"), NOT_FOUND_STATUS);
        }
        return c.json(respData(updated));
      } catch (err) {
        return rethrowAsHttp(err);
      }
    },
  )
  .delete(
    "/:id",
    requireAuth,
    requirePermission(PERMISSION_DELETE),
    zValidator("param", idParam),
    async (c) => {
      const { id } = c.req.valid("param");
      await deletePost(id);
      return c.json(respOk());
    },
  );
