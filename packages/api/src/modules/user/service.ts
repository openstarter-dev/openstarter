// packages/api/src/user/service —— 面向当前用户的自助数据服务（Settings_Panel 数据面，R27）。
//
// 汇集 Settings_Panel（任务 34）所需的、以「当前登录用户」为范围的只读查询：
//   - 订单/支付记录（本服务 `listUserOrders`）：直接查 `order` 表（按 userId 过滤、排除软删），
//     供「支付记录」区块分页展示；不复用 billing 的支付编排（那是写路径），仅做读投影。
//   - 订阅状态视图、积分余额/历史、方案状态：分别复用 `@openstarter/billing`
//     （`getSubscriptionStatusView`/`getBalance`/`getHistory`）与 `@openstarter/auth`
//     （`getUserPlan`）的既有服务函数——本服务不重复其领域逻辑。
//
// 依赖分层 api → db（读投影）/ billing / auth，无反向、无环。所有查询均以路由中间件解析出的
// `userId` 为范围，天然隔离他人数据（R27：仅本人自助数据）。

import { order } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";

export type UserOrder = typeof order.$inferSelect;

export interface ListUserOrdersParams {
  page: number;
  pageSize: number;
  userId: string;
}

export interface ListUserOrdersResult {
  items: UserOrder[];
  total: number;
}

/**
 * 分页返回当前用户的订单（支付记录），按创建时间倒序，排除软删（`deletedAt` 非空）。
 * 仅以 `userId` 为范围——不暴露他人订单（R27 自助数据隔离）。
 */
export async function listUserOrders(params: ListUserOrdersParams): Promise<ListUserOrdersResult> {
  const { userId, page, pageSize } = params;
  const database = db();
  const where = and(eq(order.userId, userId), isNull(order.deletedAt));

  const [items, totalRows] = await Promise.all([
    database
      .select()
      .from(order)
      .where(where)
      .orderBy(desc(order.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    database.select({ value: count() }).from(order).where(where),
  ]);

  return { items, total: totalRows[0]?.value ?? 0 };
}
