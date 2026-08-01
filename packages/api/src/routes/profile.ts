// packages/api/src/routes/profile —— 当前用户资料自助路由（CLI 与 Settings 面板数据面）。
//
// 全挂 `requireAuth`（会话或有效 API Key），以中间件解析出的 `c.get("userId")` 为唯一范围，
// 天然隔离他人数据。
//   - GET /api/profile    当前用户基本资料投影（id/email/name/createdAt）；
//   - PATCH /api/profile  更新当前用户显示名（仅 name 可改，余字段只读）。
// 响应统一走 `{ code, message, data? }` 信封（@openstarter/shared）。

import { db } from "@openstarter/db/server";
import { user as userTable } from "@openstarter/db/schema";
import { respData, respErr } from "@openstarter/shared";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

import { requireAuth } from "../middleware/auth";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

/** 客户端可见的用户资料投影：仅暴露非敏感字段。 */
interface ProfileView {
  createdAt: Date | null;
  email: string;
  id: string;
  name: string;
}

const selectFields = {
  createdAt: userTable.createdAt,
  email: userTable.email,
  id: userTable.id,
  name: userTable.name,
} as const;

function toView(row: {
  createdAt: Date | null;
  email: string;
  id: string;
  name: string | null;
}): ProfileView {
  return { createdAt: row.createdAt, email: row.email, id: row.id, name: row.name ?? "" };
}

export const profileRoute = new Hono()
  .get("/api/profile", requireAuth, async (c) => {
    const userId = c.get("userId");
    const row = await db()
      .select(selectFields)
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!row) {
      return c.json(respErr("user not found"), 404);
    }
    return c.json(respData(toView(row)));
  })
  .patch(
    "/api/profile",
    requireAuth,
    zValidator("json", updateSchema),
    async (c) => {
      const { name } = c.req.valid("json");
      if (name === undefined) {
        return c.json(respErr("no updatable fields provided"), 422);
      }
      const userId = c.get("userId");

      const updated = await db()
        .update(userTable)
        .set({ name })
        .where(eq(userTable.id, userId))
        .returning(selectFields)
        .then((rows) => rows[0]);

      if (!updated) {
        return c.json(respErr("user not found"), 404);
      }
      return c.json(respData(toView(updated)));
    },
  );
