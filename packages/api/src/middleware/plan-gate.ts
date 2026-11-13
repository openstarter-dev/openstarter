import { getUserPlan, type UserPlan } from "@openstarter/auth";
import { respErr } from "@openstarter/shared";
import { createMiddleware } from "hono/factory";

const PLAN_HIERARCHY: Record<UserPlan, number> = {
  none: 0,
  trial: 1,
  expired: 0,
  member: 2,
};

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
