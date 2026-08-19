// packages/api/src/modules/auth —— 账户解绑路由（R4.1）。
//
// 必须**先于** Better Auth wildcard（`/api/auth/*`）注册：条件 DELETE 在数据库语句级维护
// “至少一个登录方式”不变量，防止并发直接 API 请求绕过。多路径守卫应对尾斜杠/双斜杠变体。

import { createAuth } from "@openstarter/auth";
import { AccountUnlinkError, unlinkAccountSafely } from "@openstarter/auth/accounts/unlink";
import { Hono } from "hono";
import { z } from "zod";

const unlinkAccountSchema = z
  .object({
    accountId: z.string().min(1).optional(),
    providerId: z.string().min(1),
  })
  .strict();

const UNLINK_ACCOUNT_PATHS = [
  "/auth/unlink-account",
  "/auth/unlink-account/",
  "/auth//unlink-account",
];

export const authRouter = new Hono().on("POST", UNLINK_ACCOUNT_PATHS, async (c) => {
  const session = await createAuth().api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session?.user) {
    return c.json({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ code: "INVALID_BODY", message: "Invalid request" }, 400);
  }
  const parsed = unlinkAccountSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ code: "INVALID_BODY", message: "Invalid request" }, 400);
  }

  try {
    await unlinkAccountSafely({
      ...parsed.data,
      userId: session.user.id,
    });
    return c.json({ status: true });
  } catch (error) {
    if (error instanceof AccountUnlinkError) {
      return c.json({ code: error.code, message: error.message }, 400);
    }
    throw error;
  }
});
