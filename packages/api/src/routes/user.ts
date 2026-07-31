// packages/api/src/routes/user —— 当前用户自助数据路由（Settings_Panel 数据面，R27）。
//
// 全部挂 `requireAuth`（会话或有效 API Key），以中间件解析出的 `c.get("userId")` 为唯一范围，
// 天然隔离他人数据（R27：仅本人自助数据）。均为只读投影，供 Settings_Panel 的账单/订阅、积分、
// 支付记录区块经类型化 RPC 消费：
//   - GET /api/user/subscription   当前订阅状态视图（状态/套餐名/下一计费日，R11.4/R27.2）；
//   - GET /api/user/plan           方案状态（none/trial/expired/member，R9.6/R27.2）；
//   - GET /api/user/credits        积分余额 + 流水历史（R13/R27.4）；
//   - GET /api/user/orders         支付记录分页（R27.2）。

import { zValidator } from "@hono/zod-validator";
import { getUserPermissionCodes, getUserPlan } from "@openstarter/auth";
import {
  getBalance,
  getHistory,
  getSubscriptionStatusView,
} from "@openstarter/billing-web";
import { respData, respPage } from "@openstarter/shared";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { listUserOrders } from "../user";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_HISTORY_LIMIT = 50;

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

const creditsQuery = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_HISTORY_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

export const userRoute = new Hono()
  // 当前用户的平台级权限码集合（含通配符）。供 Admin_Console 的路由守卫与菜单过滤
  // （R26.1/R26.4）在客户端以纯函数 `matchPermission` 判定；仅返回本人权限，不泄露他人。
  .get("/api/user/permissions", requireAuth, async (c) => {
    const codes = await getUserPermissionCodes(c.get("userId"));
    return c.json(respData(codes));
  })
  .get("/api/user/subscription", requireAuth, async (c) => {
    const view = await getSubscriptionStatusView(c.get("userId"));
    return c.json(respData(view));
  })
  .get("/api/user/plan", requireAuth, async (c) => {
    const plan = await getUserPlan(c.get("userId"));
    return c.json(respData(plan));
  })
  .get(
    "/api/user/credits",
    requireAuth,
    zValidator("query", creditsQuery),
    async (c) => {
      const { limit, offset } = c.req.valid("query");
      const userId = c.get("userId");
      const [balance, history] = await Promise.all([
        getBalance(userId),
        getHistory(userId, { limit, offset }),
      ]);
      return c.json(respData({ balance, history }));
    }
  )
  .get(
    "/api/user/orders",
    requireAuth,
    zValidator("query", listQuery),
    async (c) => {
      const { page, pageSize } = c.req.valid("query");
      const { items, total } = await listUserOrders({
        page,
        pageSize,
        userId: c.get("userId"),
      });
      return c.json(respPage(items, total));
    }
  );
