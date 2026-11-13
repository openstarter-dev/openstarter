import { getUserPlan } from "@openstarter/auth";
import { respData, respErr, respPage } from "@openstarter/shared";
import { Hono } from "hono";

import { zValidator } from "../../lib/validator";
import { requireAuth } from "../../middleware/auth";
import { paginationSchema } from "../../schema";
import { creditsQuery, updateProfileSchema } from "../../schema/user";
import { getDashboardStats, getUserProfile, listUserOrders, updateUserProfile } from "./index";
import {
  getBalance,
  getCurrentSubscription,
  getHistory,
  getSubscriptionStatusView,
} from "@openstarter/billing-web";
import { getPaymentManager } from "@openstarter/billing-web/payment";

const NOT_FOUND_STATUS = 404;
const UNPROCESSABLE_STATUS = 422;

export const userRouter = new Hono()
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
  // 当前用户的仪表盘汇总统计（余额 + 近 30 天积分授予/消耗、订单、消费、活跃 Key、逐日趋势）
  .get("/user/dashboard-stats", requireAuth, async (c) => {
    const userId = c.get("userId");
    const [balance, stats] = await Promise.all([getBalance(userId), getDashboardStats(userId)]);
    return c.json(respData({ ...stats, balance }));
  })
  // 当前用户的支付记录分页
  .get("/user/orders", requireAuth, zValidator("query", paginationSchema), async (c) => {
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
    const profile = await getUserProfile(c.get("userId"));
    if (!profile) {
      return c.json(respErr("user not found"), NOT_FOUND_STATUS);
    }
    return c.json(respData(profile));
  })
  // 更新当前用户资料
  .patch("/profile", requireAuth, zValidator("json", updateProfileSchema), async (c) => {
    const { name } = c.req.valid("json");
    if (name === undefined) {
      return c.json(respErr("no updatable fields provided"), UNPROCESSABLE_STATUS);
    }

    const profile = await updateUserProfile(c.get("userId"), { name });
    if (!profile) {
      return c.json(respErr("user not found"), NOT_FOUND_STATUS);
    }
    return c.json(respData(profile));
  })
  // 获取计费 portal URL
  .post("/user/billing-portal", requireAuth, async (c) => {
    const userId = c.get("userId");
    const origin = new URL(c.req.url).origin;

    const currentSub = await getCurrentSubscription(userId);
    if (!currentSub?.paymentUserId) {
      return c.json(respErr("No active subscription with a payment provider customer ID"), 400);
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
