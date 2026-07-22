import { createAuth, validateApiKey } from "@openstarter/auth";
import { respErr } from "@openstarter/shared";
import { createMiddleware } from "hono/factory";

type Session = Awaited<
  ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>
>;

const BEARER_PREFIX = "Bearer ";
const API_KEY_PREFIX = "sk_";

/**
 * 从 `Authorization: Bearer sk_...` 头解析 API 密钥并经 APIKey_Service 校验，
 * 命中则返回所属 userId，否则返回 null。R8.2
 */
async function resolveApiKeyUserId(headers: Headers): Promise<string | null> {
  const authorization = headers.get("authorization");
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = authorization.slice(BEARER_PREFIX.length).trim();
  if (!token.startsWith(API_KEY_PREFIX)) {
    return null;
  }
  return await validateApiKey(token);
}

/**
 * 注入会话中间件：解析 better-auth 会话并写入 `c.var.session`（可为 null）。
 * 不做拦截，供需要「可选会话」的路由读取当前主体。
 */
export const authMiddleware = createMiddleware<{
  Variables: { session: Session };
}>(async (c, next) => {
  const session = await createAuth().api.getSession({
    headers: c.req.raw.headers,
  });
  c.set("session", session);
  await next();
});

/**
 * API 密钥鉴权守卫（R8.2/R8.5）：无有效 `Bearer sk_...` 即以结构化 401 拒绝，
 * 命中则将所属 userId 写入 `c.var.userId`。供纯 API Key 场景的路由复用。
 */
export const apiKeyAuth = createMiddleware<{
  Variables: { userId: string };
}>(async (c, next) => {
  const userId = await resolveApiKeyUserId(c.req.raw.headers);
  if (!userId) {
    return c.json(respErr("unauthorized"), 401);
  }
  c.set("userId", userId);
  await next();
});

/**
 * 会话鉴权守卫（R4.2/R4.5）：融合「会话或有效 API Key」——
 *   1. 优先解析 better-auth 会话；命中则写入 `session` 与 `userId`；
 *   2. 否则回退到 `Authorization: Bearer sk_...` 的 API Key 校验；命中则 `session=null`、写入 `userId`；
 *   3. 二者皆无效返回结构化 401。
 *
 * 完成阶段 0 预留的 API Key 分支：受保护端点读取 `c.var.userId` 即可无差别支持两种主体。
 */
export const requireAuth = createMiddleware<{
  Variables: { userId: string; session: Session };
}>(async (c, next) => {
  const session = await createAuth().api.getSession({
    headers: c.req.raw.headers,
  });
  if (session?.user) {
    c.set("session", session);
    c.set("userId", session.user.id);
    await next();
    return;
  }

  const userId = await resolveApiKeyUserId(c.req.raw.headers);
  if (userId) {
    c.set("session", null);
    c.set("userId", userId);
    await next();
    return;
  }

  return c.json(respErr("unauthorized"), 401);
});
