import { respData, respErr, respOk, respPage } from "@openstarter/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { zValidator } from "../../../lib/validator";
import { SlugConflictError } from "../errors";
import { createPost, deletePost, getPostById, listPosts, updatePost } from "../posts";
import { requireAuth } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/rbac";
import { idParam } from "../../../schema";
import { createBody, listQuery, updateBody } from "../../../schema/content/posts";

const SLUG_CONFLICT_STATUS = 409;
const NOT_FOUND_STATUS = 404;

const PERMISSION_READ = "post.read";
const PERMISSION_CREATE = "post.create";
const PERMISSION_UPDATE = "post.update";
const PERMISSION_DELETE = "post.delete";

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
