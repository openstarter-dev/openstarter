import { respData, respErr, respOk, respPage } from "@openstarter/shared";
import { Hono } from "hono";

import { zValidator } from "../../../lib/validator";
import { requireAuth } from "../../../middleware/auth";
import { requirePlan } from "../../../middleware/plan-gate";
import { requirePermission } from "../../../middleware/rbac";
import { idParam } from "../../../schema";
import { createBody, listQuery, updateBody } from "../../../schema/ai/catalog";
import {
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

export const aiModelsRouter = new Hono().get(
  "/ai/models",
  requireAuth,
  requirePlan("member"),
  async (c) => {
    const grouped = await listAvailableModelsByMediaType();
    return c.json(respData(grouped));
  },
);

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
