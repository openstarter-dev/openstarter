import { createApiKey, listApiKeys, revokeApiKey } from "@openstarter/auth";
import { respData, respOk, respPage } from "@openstarter/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../../../middleware/auth";
import { idParam, createPaginationSchema } from "../../../schema";

const createBody = z.object({ title: z.string().min(1) });

const listQuery = createPaginationSchema(100, 10).extend({
  search: z.string().optional(),
});

export const apikeysRouter = new Hono()
  .get("/", requireAuth, zValidator("query", listQuery), async (c) => {
    const { page, pageSize, search } = c.req.valid("query");
    const { items, total } = await listApiKeys(c.get("userId"), page, pageSize, search);
    return c.json(respPage(items, total));
  })
  .post("/", requireAuth, zValidator("json", createBody), async (c) => {
    const { title } = c.req.valid("json");
    const created = await createApiKey({ userId: c.get("userId"), title });
    return c.json(respData(created));
  })
  .delete("/", requireAuth, zValidator("query", idParam), async (c) => {
    const { id } = c.req.valid("query");
    await revokeApiKey({ userId: c.get("userId"), keyId: id });
    return c.json(respOk());
  });
