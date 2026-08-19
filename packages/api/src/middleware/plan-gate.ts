// packages/api/src/middleware/plan-gate —— 订阅方案守卫中间件。
//
// `requirePlan(plan)` 在 `requireAuth` 之后使用（读取 `c.var.userId`），
// 检查已认证用户的方案等级是否满足所要求的最低门槛。
//
// 方案层级：none < trial < member。用户持有 "member" 方案可访问任何层级，
// "trial" 可访问 trial 及以下，"none" 仅可访问公开层级。
//
// 拒绝语义：未认证 → 401，方案不足 → 403。

import { getUserPlan, type UserPlan } from "@openstarter/auth";
import { respErr } from "@openstarter/shared";
import { createMiddleware } from "hono/factory";

/** 方案等级映射：值越大门槛越高。 */
const PLAN_HIERARCHY: Record<UserPlan, number> = {
  none: 0,
  trial: 1,
  expired: 0,
  member: 2,
};

/**
 * 要求已认证用户至少达到指定的方案等级。
 *
 * @param minimumPlan - 所需最低方案等级
 * @returns Hono 中间件
 *
 * @example
 * ```ts
 * import { requirePlan } from "../middleware/plan-gate";
 *
 * app.post("/api/ai-tasks", requireAuth, requirePlan("member"), handler);
 * ```
 */
export function requirePlan(minimumPlan: UserPlan) {
  return createMiddleware<{ Variables: { userId: string } }>(async (c, next) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json(respErr("Unauthorized"), 401);
    }

    const { plan } = await getUserPlan(userId);
    const userLevel = PLAN_HIERARCHY[plan] ?? 0;
    const requiredLevel = PLAN_HIERARCHY[minimumPlan] ?? 0;

    if (userLevel < requiredLevel) {
      return c.json(
        respErr(`This feature requires a ${minimumPlan} plan. Current plan: ${plan}.`),
        403,
      );
    }

    await next();
  });
}
