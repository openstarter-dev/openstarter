import { zValidator } from "@hono/zod-validator";
import { getUserPermissionCodes, getUserPlan } from "@openstarter/auth";
import { user as userTable } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { respData, respErr, respPage } from "@openstarter/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../../middleware/auth";
import { paginationSchema } from "../../schema";
import { listUserOrders } from "./index";
import {
  getBalance,
  getCurrentSubscription,
  getHistory,
  getSubscriptionStatusView,
} from "@openstarter/billing-web";
import { getPaymentManager } from "@openstarter/billing-web/payment";

const DEFAULT_HISTORY_LIMIT = 50;

const listQuery = paginationSchema;

const creditsQuery = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(DEFAULT_HISTORY_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

const updateProfileSchema = z.object({
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
  return {
    createdAt: row.createdAt,
    email: row.email,
    id: row.id,
    name: row.name ?? "",
  };
}

export const userRouter = new Hono()
  // 当前用户的平台级权限码集合
  .get("/user/permissions", requireAuth, async (c) => {
    const codes = await getUserPermissionCodes(c.get("userId"));
    return c.json(respData(codes));
  })
  // 当前用户的订阅状态视图
  .get("/user/subscription", requireAuth, async (c) => {
    const view = await getSubscriptionStatusView(c.get("userId"));
    return c.json(respData(view));
  })
  // 当前用户的方案状态
  .get("/user/plan", requireAuth, async (c) => {
    const plan = await getUserPlan(c.get("userId"));
    return c.json(respData(plan));
  })
  // 当前用户的积分余额 + 流水历史
  .get("/user/credits", requireAuth, zValidator("query", creditsQuery), async (c) => {
    const { limit, offset } = c.req.valid("query");
    const userId = c.get("userId");
    const [balance, history] = await Promise.all([
      getBalance(userId),
      getHistory(userId, { limit, offset }),
    ]);
    return c.json(respData({ balance, history }));
  })
  // 当前用户的支付记录分页
  .get("/user/orders", requireAuth, zValidator("query", listQuery), async (c) => {
    const { page, pageSize } = c.req.valid("query");
    const { items, total } = await listUserOrders({
      page,
      pageSize,
      userId: c.get("userId"),
    });
    return c.json(respPage(items, total));
  })
  // 获取当前用户资料
  .get("/profile", requireAuth, async (c) => {
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
  // 更新当前用户资料
  .patch("/profile", requireAuth, zValidator("json", updateProfileSchema), async (c) => {
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
  })
  // 获取计费 portal URL
  .post("/user/billing-portal", requireAuth, async (c) => {
    const userId = c.get("userId");
    const origin = new URL(c.req.url).origin;

    const currentSub = await getCurrentSubscription(userId);
    if (!currentSub?.paymentUserId) {
      return c.json(
        respErr("No active subscription with a payment provider customer ID"),
        400
      );
    }

    const manager = await getPaymentManager();
    const provider = manager.getProvider("stripe");
    if (!provider?.getPaymentBilling) {
      return c.json(respErr("Stripe payment provider is not available"), 400);
    }

    const result = await provider.getPaymentBilling({
      customerId: currentSub.paymentUserId,
      returnUrl: `${origin}/settings/billing`,
    });

    return c.json(respData({ billingUrl: result.billingUrl }));
  });