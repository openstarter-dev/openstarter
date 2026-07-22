// packages/api/src/routes/apikeys —— API 密钥管理路由（R8.1/R8.3/R8.4）。
//
// 创建 / 列表 / 吊销，全部挂 `requireAuth`（会话或有效 API Key）。
// 明文密钥仅在创建响应中一次性返回；列表仅暴露前缀。

import { createApiKey, listApiKeys, revokeApiKey } from "@openstarter/auth";
import { respData, respOk, respPage } from "@openstarter/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;

const createBody = z.object({ title: z.string().min(1) });

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  search: z.string().optional(),
});

const deleteQuery = z.object({ id: z.string().min(1) });

export const apikeysRoute = new Hono()
  .get(
    "/api/apikeys",
    requireAuth,
    zValidator("query", listQuery),
    async (c) => {
      const { page, pageSize, search } = c.req.valid("query");
      const { items, total } = await listApiKeys(
        c.get("userId"),
        page,
        pageSize,
        search
      );
      return c.json(respPage(items, total));
    }
  )
  .post(
    "/api/apikeys",
    requireAuth,
    zValidator("json", createBody),
    async (c) => {
      const { title } = c.req.valid("json");
      const created = await createApiKey({ userId: c.get("userId"), title });
      return c.json(respData(created));
    }
  )
  .delete(
    "/api/apikeys",
    requireAuth,
    zValidator("query", deleteQuery),
    async (c) => {
      const { id } = c.req.valid("query");
      await revokeApiKey({ userId: c.get("userId"), keyId: id });
      return c.json(respOk());
    }
  );
